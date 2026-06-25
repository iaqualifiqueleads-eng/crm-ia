import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  InteractionDirection, InteractionStatus, InteractionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRuntimeService } from '../agents/agent-runtime.service';
import { MESSAGING_PROVIDER, MessagingProvider } from '../messaging/messaging.types';
import { QUEUES, JOBS, ProcessInboundJobData } from './whatsapp.queue';

/**
 * Limite anti-loop: máx 3 respostas do agente por cliente em 60 segundos.
 * Aplicado em código antes de processar cada job.
 */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_RESPONSES = 3;

@Processor(QUEUES.AGENT_RESPONSE)
export class AgentResponseWorker extends WorkerHost {
  private readonly logger = new Logger(AgentResponseWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AgentRuntimeService,
    @Inject(MESSAGING_PROVIDER) private readonly messaging: MessagingProvider,
  ) { super(); }

  async process(job: Job): Promise<any> {
    if (job.name !== JOBS.PROCESS_INBOUND) {
      this.logger.warn(`Job desconhecido: ${job.name}`);
      return null;
    }

    const data = job.data as ProcessInboundJobData;

    // 1. Anti-loop / rate limit
    if (await this.isOverRateLimit(data.customerId)) {
      this.logger.warn(`Rate limit excedido para customer=${data.customerId} — pulando`);
      return { skipped: true, reason: 'rate-limit' };
    }

    // 2. Resolve qual agente atende esse cliente
    const agent = await this.runtime.resolveAgentForCustomer(data.customerId);
    if (!agent) {
      this.logger.warn(`Sem agente disponível para customer=${data.customerId}`);
      return { skipped: true, reason: 'no-agent' };
    }

    // 3. Verifica se o cliente já não está aguardando humano (não responde IA)
    const customer = await this.prisma.customer.findUnique({
      where: { id: data.customerId },
      select: { whatsapp: true, phone: true },
    });
    if (!customer) return { skipped: true, reason: 'customer-gone' };

    const phoneTo = customer.whatsapp ?? customer.phone;
    if (!phoneTo) {
      this.logger.warn(`Cliente ${data.customerId} sem número`);
      return { skipped: true, reason: 'no-phone' };
    }

    // 4. Roda o turno do agente
    const turn = await this.runtime.runTurn({
      agentId: agent.id,
      customerId: data.customerId,
      userMessage: data.text,
      triggerInteractionId: data.interactionId,
      source: 'conversation',
      persist: true,
    });

    if (!turn.responseText?.trim()) {
      this.logger.debug('Agente não retornou texto — nada a enviar');
      return { ok: true, sent: false };
    }

    // 5. Envia via WhatsApp (Evolution)
    const sendResult = await this.messaging.send({
      to: phoneTo,
      text: turn.responseText,
      externalRef: turn.outboundInteractionId,
    });

    // 6. Atualiza o status da Interaction outbound criada pelo runtime
    if (turn.outboundInteractionId) {
      try {
        await this.prisma.interaction.update({
          where: { id: turn.outboundInteractionId },
          data: {
            status: sendResult.status === 'SENT' ? InteractionStatus.SENT : InteractionStatus.FAILED,
            externalId: sendResult.externalId,
            sentAt: sendResult.sentAt,
            failedReason: sendResult.errorMessage,
          },
        });
      } catch (err: any) {
        // P2002 = externalId duplicado — não é crítico, mensagem já foi enviada
        if (err?.code !== 'P2002') throw err;
        this.logger.warn(`externalId duplicado ao atualizar outbound ${turn.outboundInteractionId} — ignorado`);
      }
    }

    return {
      ok: true,
      ended: turn.ended,
      tokens: turn.usage.totalTokens,
      costBrl: turn.usage.costBrl,
    };
  }

  // ----- helpers -----
  private async isOverRateLimit(customerId: string): Promise<boolean> {
    const since = new Date(Date.now() - RATE_WINDOW_MS);
    const count = await this.prisma.interaction.count({
      where: {
        customerId,
        direction: InteractionDirection.OUTBOUND,
        type: InteractionType.WHATSAPP_AI,
        createdAt: { gte: since },
      },
    });
    return count >= RATE_MAX_RESPONSES;
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Worker job ${job?.id} falhou: ${error.message}`);
  }
}
