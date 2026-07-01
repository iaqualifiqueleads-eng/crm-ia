import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { CampaignStatus, CampaignCustomerStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { InteractionsService } from '../interactions/interactions.service';
import { msUntilBusinessHours } from '../common/business-hours.util';
import { QUEUES, JOBS, CampaignSendJobData } from '../workers/workers.types';

@Processor(QUEUES.CAMPAIGN)
export class CampaignWorker extends WorkerHost {
  private readonly logger = new Logger(CampaignWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interactions: InteractionsService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name === JOBS.CAMPAIGN_SEND) {
      return this.runCampaignSend(job);
    }
    this.logger.warn(`Job desconhecido: ${job.name}`);
  }

  private async runCampaignSend(job: Job<CampaignSendJobData>) {
    const data = job.data;

    // 1. Verifica se a campanha ainda está RUNNING
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: data.campaignId },
      select: { status: true },
    });

    if (!campaign) {
      this.logger.warn(`Campanha ${data.campaignId} não encontrada — job ignorado`);
      return { skipped: true, reason: 'campaign-not-found' };
    }

    if (campaign.status === CampaignStatus.PAUSED) {
      // Reagenda para daqui a 5 minutos e aguarda reativação
      this.logger.log(`Campanha ${data.campaignId} pausada — reagendando job em 5min`);
      await job.moveToDelayed(Date.now() + 5 * 60 * 1000);
      return { rescheduled: true, reason: 'paused' };
    }

    if (campaign.status === CampaignStatus.CANCELLED) {
      await this.markCustomer(data.campaignCustomerId, CampaignCustomerStatus.SKIPPED, 'Campanha cancelada');
      await this.updateCounters(data.campaignId);
      return { skipped: true, reason: 'cancelled' };
    }

    // 2. Verifica horário comercial (mesmo comportamento do replenishment)
    const delayMs = msUntilBusinessHours();
    if (delayMs > 0) {
      const resumeAt = new Date(Date.now() + delayMs);
      this.logger.log(`Fora do horário comercial — reagendando campaign job para ${resumeAt.toISOString()}`);
      await job.moveToDelayed(Date.now() + delayMs);
      return { rescheduled: true, resumeAt };
    }

    // 3. Verifica se o CampaignCustomer ainda está PENDING (pode ter sido removido)
    const cc = await this.prisma.campaignCustomer.findUnique({
      where: { id: data.campaignCustomerId },
      select: { status: true },
    });

    if (!cc || cc.status !== CampaignCustomerStatus.PENDING) {
      this.logger.warn(`CampaignCustomer ${data.campaignCustomerId} não está PENDING — ignorando`);
      return { skipped: true, reason: 'not-pending' };
    }

    // 4. Envia mensagem
    try {
      const interaction = await this.interactions.sendAutomatedMessage({
        customerId: data.customerId,
        templateId: data.templateId,
        automationRef: data.automationRef,
      });

      const succeeded = interaction.status !== 'FAILED';
      await this.markCustomer(
        data.campaignCustomerId,
        succeeded ? CampaignCustomerStatus.SENT : CampaignCustomerStatus.FAILED,
        succeeded ? undefined : (interaction.failedReason ?? 'Falha desconhecida'),
        succeeded ? new Date() : undefined,
      );
    } catch (err: any) {
      await this.markCustomer(
        data.campaignCustomerId,
        CampaignCustomerStatus.FAILED,
        err?.message ?? 'Erro interno',
      );
    }

    await this.updateCounters(data.campaignId);
    return { ok: true };
  }

  private async markCustomer(
    campaignCustomerId: string,
    status: CampaignCustomerStatus,
    failedReason?: string,
    sentAt?: Date,
  ) {
    await this.prisma.campaignCustomer.update({
      where: { id: campaignCustomerId },
      data: { status, failedReason: failedReason ?? null, sentAt: sentAt ?? null },
    });
  }

  // Recalcula contadores e, se todos os clientes foram processados, marca como DONE
  private async updateCounters(campaignId: string) {
    const counts = await this.prisma.campaignCustomer.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    const byStatus: Record<string, number> = {};
    for (const c of counts) byStatus[c.status] = c._count.status;

    const sentCount    = byStatus[CampaignCustomerStatus.SENT]    ?? 0;
    const failedCount  = byStatus[CampaignCustomerStatus.FAILED]  ?? 0;
    const skippedCount = byStatus[CampaignCustomerStatus.SKIPPED] ?? 0;
    const pendingCount = byStatus[CampaignCustomerStatus.PENDING] ?? 0;

    const allDone = pendingCount === 0;

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        sentCount,
        failedCount,
        skippedCount,
        ...(allDone ? { status: CampaignStatus.DONE, finishedAt: new Date() } : {}),
      },
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Campaign job ${job.id} concluído`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Campaign job ${job?.id} falhou: ${error.message}`);
  }
}
