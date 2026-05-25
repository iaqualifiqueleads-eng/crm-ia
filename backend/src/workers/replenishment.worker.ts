import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { TemplateTrigger, TaskPriority, TaskType } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { InteractionsService } from '../interactions/interactions.service';
import { AutomationService } from '../automation/automation.service';
import { TasksService } from '../tasks/tasks.service';
import {
  QUEUES,
  JOBS,
  SendReminderJobData,
  CheckRetryJobData,
} from './workers.types';

@Processor(QUEUES.REPLENISHMENT)
export class ReplenishmentWorker extends WorkerHost {
  private readonly logger = new Logger(ReplenishmentWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastService,
    private readonly interactions: InteractionsService,
    private readonly automation: AutomationService,
    private readonly tasks: TasksService,
    @InjectQueue(QUEUES.MESSAGE_RETRY) private readonly retryQueue: Queue,
  ) { super(); }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processando job ${job.name} (id=${job.id})`);
    switch (job.name) {
      case JOBS.DAILY_SCAN:
        return this.runDailyScan();
      case JOBS.SEND_REMINDER:
        return this.runSendReminder(job.data as SendReminderJobData);
      default:
        this.logger.warn(`Job desconhecido: ${job.name}`);
        return null;
    }
  }

  // =========================================================
  // 1) DAILY SCAN — varre clientes próximos do prazo e enfileira envios
  // =========================================================
  private async runDailyScan() {
    const config = await this.automation.getReplenishmentConfig();
    if (!config.enabled) {
      this.logger.log('Cadência desabilitada — daily scan pulado');
      return { scanned: 0, scheduled: 0 };
    }

    if (!config.defaultReminderTemplateId) {
      this.logger.warn('Sem defaultReminderTemplateId configurado — daily scan pulado');
      return { scanned: 0, scheduled: 0, reason: 'no-template' };
    }

    // Atualiza overdues primeiro (também usado pelo dashboard)
    await this.forecast.refreshAllOverdues();

    // Define a "janela" de clientes a contatar HOJE:
    // nextReplenishmentAt entre (hoje + 0 dias) e (hoje + remindBeforeDays + 1 dia)
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const target = new Date(start);
    target.setDate(target.getDate() + (config.remindBeforeDays ?? 0) + 1);

    const candidates = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        nextReplenishmentAt: { gte: start, lt: target },
      },
      select: { id: true, companyName: true },
    });

    const today = start.toISOString().split('T')[0];
    let scheduled = 0;

    for (const c of candidates) {
      const automationRef = `REPL_${today}_${c.id}`;
      // Evita duplicidade — se já existe interaction com esse automationRef, pula
      const existing = await this.prisma.interaction.findFirst({
        where: { customerId: c.id, automationRef },
      });
      if (existing) continue;

      await this.runSendReminder({
        customerId: c.id,
        templateId: config.defaultReminderTemplateId!,
        automationRef,
      });
      scheduled++;
    }

    this.logger.log(`Daily scan: ${candidates.length} candidatos, ${scheduled} enviados`);
    return { scanned: candidates.length, scheduled };
  }

  // =========================================================
  // 2) SEND REMINDER — envia a 1ª mensagem e agenda retry 1h
  // =========================================================
  private async runSendReminder(data: SendReminderJobData) {
    const config = await this.automation.getReplenishmentConfig();

    try {
      const interaction = await this.interactions.sendAutomatedMessage({
        customerId: data.customerId,
        templateId: data.templateId,
        automationRef: data.automationRef,
      });

      // Agenda primeira verificação de retry (1h depois, por padrão)
      const retryDelays = config.retryDelaysHours ?? [1, 3, 24];
      const delayMs = retryDelays[0] * 60 * 60 * 1000;
      await this.retryQueue.add(
        JOBS.CHECK_RETRY,
        {
          customerId: data.customerId,
          previousInteractionId: interaction.id,
          retryStep: 1,
          automationRef: data.automationRef,
        } satisfies CheckRetryJobData,
        { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
      );

      return { ok: true, interactionId: interaction.id };
    } catch (err) {
      this.logger.error(`Falha em SEND_REMINDER customer=${data.customerId}`, err as Error);
      throw err; // BullMQ marca como failed e respeita attempts
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} (${job.name}) concluído`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job?.id} (${job?.name}) falhou: ${error.message}`);
  }
}
