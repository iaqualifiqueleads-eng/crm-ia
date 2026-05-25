import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  TaskType,
  TaskPriority,
  NotificationSeverity,
  UserRole,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { AutomationService } from '../automation/automation.service';
import { TasksService } from '../tasks/tasks.service';
import { NotificationsService } from '../notifications/notifications.service';
import { QUEUES, JOBS } from './workers.types';

/**
 * Job diário que:
 *  1. Atualiza daysOverdue de todos os clientes
 *  2. Cria tarefa urgente para clientes que cruzaram overdueTaskAfterDays
 *  3. Notifica supervisor + gerente para clientes que cruzaram escalateToManagementAfterDays
 */
@Processor(QUEUES.OVERDUE_ESCALATION)
export class OverdueEscalationWorker extends WorkerHost {
  private readonly logger = new Logger(OverdueEscalationWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastService,
    private readonly automation: AutomationService,
    private readonly tasks: TasksService,
    private readonly notifications: NotificationsService,
  ) { super(); }

  async process(job: Job): Promise<any> {
    if (job.name !== JOBS.DAILY_OVERDUE) {
      this.logger.warn(`Job desconhecido: ${job.name}`);
      return null;
    }
    return this.runDailyOverdue();
  }

  private async runDailyOverdue() {
    const config = await this.automation.getReplenishmentConfig();

    // 1. Atualiza overdues (também roda no daily scan, mas garantimos aqui)
    await this.forecast.refreshAllOverdues();

    // 2. Clientes atrasados
    const overdueCustomers = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        daysOverdue: { gt: 0 },
      },
      select: {
        id: true,
        companyName: true,
        daysOverdue: true,
        salespersonId: true,
      },
    });

    const today = new Date().toISOString().split('T')[0];
    let tasksCreated = 0;
    let escalations = 0;

    for (const c of overdueCustomers) {
      // 2.a) Tarefa urgente após X dias de atraso
      if (c.daysOverdue >= config.overdueTaskAfterDays) {
        const task = await this.tasks.createAutomatic({
          title: `Cliente atrasado: ${c.companyName} (${c.daysOverdue} dias)`,
          description: `Cliente está ${c.daysOverdue} dias atrasado na reposição. Ligar urgente.`,
          type: TaskType.CALL,
          priority: TaskPriority.URGENT,
          assigneeId: c.salespersonId,
          customerId: c.id,
          dueDate: new Date(),
          automationRef: `OVERDUE_TASK_${c.id}`,
        });
        if (task) tasksCreated++;
      }

      // 2.b) Escalada para supervisor + gerente após N dias
      if (c.daysOverdue >= config.escalateToManagementAfterDays) {
        await this.escalateToManagement(c, today);
        escalations++;
      }
    }

    this.logger.log(
      `Overdue scan: ${overdueCustomers.length} atrasados | ${tasksCreated} tarefas | ${escalations} escaladas`,
    );

    return {
      overdueTotal: overdueCustomers.length,
      tasksCreated,
      escalations,
    };
  }

  private async escalateToManagement(
    customer: { id: string; companyName: string; daysOverdue: number; salespersonId: string },
    today: string,
  ) {
    // Encontra o supervisor do vendedor e o gerente
    const salesperson = await this.prisma.user.findUnique({
      where: { id: customer.salespersonId },
      include: { supervisor: true },
    });
    if (!salesperson) return;

    const recipientIds = new Set<string>();
    recipientIds.add(salesperson.id); // próprio vendedor (sempre)
    if (salesperson.supervisorId) recipientIds.add(salesperson.supervisorId);

    // Acha o gerente raiz
    const manager = await this.prisma.user.findFirst({
      where: { role: UserRole.MANAGER, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (manager) recipientIds.add(manager.id);

    // Idempotência — não notifica o mesmo recipient mais de uma vez por dia
    const dedupKey = `ESCALATION_${today}_${customer.id}`;
    const existing = await this.prisma.notification.findFirst({
      where: { customerId: customer.id, message: { contains: dedupKey } },
    });
    if (existing) return;

    await this.notifications.createMany(
      [...recipientIds].map((userId) => ({
        userId,
        title: `⚠️ Cliente crítico: ${customer.companyName}`,
        message:
          `${customer.companyName} está ${customer.daysOverdue} dias atrasado na reposição. ` +
          `[ref:${dedupKey}]`,
        severity: NotificationSeverity.CRITICAL,
        linkUrl: `/customers/${customer.id}`,
        customerId: customer.id,
      })),
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Overdue escalation falhou: ${error.message}`);
  }
}
