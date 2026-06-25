import { Processor, WorkerHost, OnWorkerEvent, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import {
  InteractionStatus,
  InteractionDirection,
  TaskType,
  TaskPriority,
  NotificationSeverity,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { InteractionsService } from '../interactions/interactions.service';
import { AutomationService } from '../automation/automation.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { msUntilBusinessHours } from '../common/business-hours.util';
import { QUEUES, JOBS, CheckRetryJobData } from './workers.types';

/**
 * Worker de retry de mensagens.
 *
 * Quando uma mensagem automática (WHATSAPP_AI) é enviada,
 * o ReplenishmentWorker agenda este job com delay de 1h.
 *
 * Aqui verificamos:
 *  - Se o cliente respondeu (interaction INBOUND posterior ao envio) → para
 *  - Se NÃO respondeu e ainda temos retries (step 1→2→3 = 1h, 3h, 24h) → reenvia
 *  - Se esgotou os 3 retries → cria tarefa urgente para o vendedor e notifica
 */
@Processor(QUEUES.MESSAGE_RETRY)
export class MessageRetryWorker extends WorkerHost {
  private readonly logger = new Logger(MessageRetryWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly interactions: InteractionsService,
    private readonly automation: AutomationService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.MESSAGE_RETRY) private readonly retryQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name !== JOBS.CHECK_RETRY) {
      this.logger.warn(`Job desconhecido: ${job.name}`);
      return null;
    }
    return this.runCheckRetry(job.data as CheckRetryJobData);
  }

  private async runCheckRetry(data: CheckRetryJobData) {
    const config = await this.automation.getReplenishmentConfig();

    const previous = await this.prisma.interaction.findUnique({
      where: { id: data.previousInteractionId },
    });
    if (!previous) {
      this.logger.warn(`Interação anterior ${data.previousInteractionId} não existe`);
      return { stopped: true, reason: 'previous-not-found' };
    }

    // Se já foi marcada como REPLIED, o cliente respondeu — encerra o ciclo
    if (previous.status === InteractionStatus.REPLIED) {
      this.logger.log(`Cliente ${data.customerId} já respondeu — ciclo encerrado`);
      return { stopped: true, reason: 'replied' };
    }

    // Verifica respostas posteriores ao envio (segurança extra: webhook pode falhar)
    if (previous.sentAt) {
      const reply = await this.prisma.interaction.findFirst({
        where: {
          customerId: data.customerId,
          direction: InteractionDirection.INBOUND,
          createdAt: { gt: previous.sentAt },
        },
      });
      if (reply) {
        await this.prisma.interaction.update({
          where: { id: previous.id },
          data: { status: InteractionStatus.REPLIED, repliedAt: reply.createdAt },
        });
        return { stopped: true, reason: 'reply-detected' };
      }
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, deletedAt: null },
      select: { id: true, companyName: true, salespersonId: true, status: true },
    });
    if (!customer) {
      this.logger.warn(`Cliente ${data.customerId} não existe mais`);
      return { stopped: true, reason: 'customer-gone' };
    }

    if (customer.status === 'CHURNED') {
      this.logger.log(`Cliente ${customer.companyName} está CHURNED — ciclo de retry encerrado`);
      return { stopped: true, reason: 'customer-churned' };
    }

    // Verifica horário comercial (07:00–20:00 BRT) antes de reenviar
    const businessDelayMs = msUntilBusinessHours();
    if (businessDelayMs > 0) {
      const resumeAt = new Date(Date.now() + businessDelayMs);
      this.logger.log(
        `Fora do horário comercial — reagendando CHECK_RETRY step=${data.retryStep} para ${resumeAt.toISOString()} (customer=${data.customerId})`,
      );
      await this.retryQueue.add(JOBS.CHECK_RETRY, data, {
        delay: businessDelayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
      });
      return { rescheduled: true, resumeAt };
    }

    // Decide próximo passo
    if (data.retryStep < 3) {
      // Reenvia usando o template de retry correspondente, se houver
      const templateForStep =
        data.retryStep === 1 ? config.retryTemplateIds?.retry1
        : data.retryStep === 2 ? config.retryTemplateIds?.retry2
        : config.retryTemplateIds?.retry3;

      const templateId = templateForStep ?? config.defaultReminderTemplateId;
      if (!templateId) {
        this.logger.warn('Sem template para retry — encerrando');
        return { stopped: true, reason: 'no-template' };
      }

      try {
        const newInteraction = await this.interactions.sendAutomatedMessage({
          customerId: data.customerId,
          templateId,
          automationRef: `${data.automationRef}_retry${data.retryStep}`,
        });

        const nextStep = (data.retryStep + 1) as 2 | 3;
        const retryDelays = config.retryDelaysHours ?? [1, 3, 24];
        // retryStep ∈ {1,2}; usamos a posição correspondente (1 ou 2) na tupla
        const delayHours: number = data.retryStep === 1 ? retryDelays[1] : retryDelays[2];
        const delayMs = delayHours * 60 * 60 * 1000;

        await this.retryQueue.add(
          JOBS.CHECK_RETRY,
          {
            customerId: data.customerId,
            previousInteractionId: newInteraction.id,
            retryStep: nextStep,
            automationRef: data.automationRef,
          },
          { delay: delayMs, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } },
        );

        return { ok: true, step: data.retryStep, nextStep, interactionId: newInteraction.id };
      } catch (err) {
        this.logger.error(`Falha no retry step=${data.retryStep}`, err as Error);
        throw err;
      }
    }

    // ESGOTOU OS 3 RETRIES — o cliente não respondeu.
    // Cria tarefa urgente e notifica o vendedor + chain hierárquico
    this.logger.warn(
      `Cliente ${customer.companyName} esgotou ${data.retryStep} retries sem resposta`,
    );

    await this.tasks.createAutomatic({
      title: `Cliente sem resposta: ${customer.companyName}`,
      description:
        `A IA enviou 3 tentativas (1h, 3h, 24h) e o cliente não respondeu. ` +
        `Entre em contato manualmente o quanto antes.`,
      type: TaskType.CALL,
      priority: TaskPriority.URGENT,
      assigneeId: customer.salespersonId,
      customerId: customer.id,
      automationRef: `${data.automationRef}_no_reply`,
      dueDate: new Date(),
    });

    await this.notifications.create({
      userId: customer.salespersonId,
      title: 'Cliente não respondeu à IA',
      message: `${customer.companyName} não respondeu após 3 tentativas. Tarefa urgente criada.`,
      severity: NotificationSeverity.WARNING,
      linkUrl: `/customers/${customer.id}`,
      customerId: customer.id,
    });

    return { stopped: true, reason: 'retries-exhausted', taskCreated: true };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job retry ${job?.id} falhou: ${error.message}`);
  }
}
