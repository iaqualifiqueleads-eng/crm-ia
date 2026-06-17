import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../workers/workers.types';
import {
  AutomationKey,
  DEFAULT_REPLENISHMENT_CONFIG,
  ReplenishmentFlowConfig,
} from './automation.types';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.REPLENISHMENT) private readonly replenishmentQueue: Queue,
    @InjectQueue(QUEUES.MESSAGE_RETRY) private readonly messageRetryQueue: Queue,
  ) {}

  async getReplenishmentConfig(): Promise<ReplenishmentFlowConfig> {
    const rule = await this.prisma.automationRule.findUnique({
      where: { key: AutomationKey.REPLENISHMENT_FLOW },
    });
    if (!rule || !rule.isActive) return DEFAULT_REPLENISHMENT_CONFIG;
    try {
      const parsed = JSON.parse(rule.config) as ReplenishmentFlowConfig;
      return { ...DEFAULT_REPLENISHMENT_CONFIG, ...parsed };
    } catch (e) {
      this.logger.warn('Falha ao parsear config de automação — usando defaults');
      return DEFAULT_REPLENISHMENT_CONFIG;
    }
  }

  async getQueueSummary() {
    // 1. Contatos agendados (banco)
    const scheduledContacts = await this.prisma.customer.findMany({
      where: {
        nextReplenishmentAt: { gt: new Date() },
        deletedAt: null,
      },
      orderBy: { nextReplenishmentAt: 'asc' },
      take: 500,
      select: {
        id: true,
        companyName: true,
        nextReplenishmentAt: true,
        forecastMode: true,
        manualIntervalDays: true,
        salesperson: { select: { id: true, name: true } },
      },
    });

    // 2. Jobs delayed no BullMQ
    const [replenDelayed, retryDelayed] = await Promise.all([
      this.replenishmentQueue.getDelayed(),
      this.messageRetryQueue.getDelayed(),
    ]);

    // Resolve nomes dos clientes referenciados nos jobs
    const jobCustomerIds = [
      ...new Set([
        ...replenDelayed.map((j) => j.data?.customerId).filter(Boolean),
        ...retryDelayed.map((j) => j.data?.customerId).filter(Boolean),
      ]),
    ] as string[];

    const jobCustomers = jobCustomerIds.length
      ? await this.prisma.customer.findMany({
          where: { id: { in: jobCustomerIds } },
          select: { id: true, companyName: true },
        })
      : [];
    const customerMap = Object.fromEntries(jobCustomers.map((c) => [c.id, c.companyName]));

    const formatJob = (job: any, queue: string) => ({
      id: String(job.id),
      queue,
      name: job.name as string,
      customerId: (job.data?.customerId as string) ?? null,
      companyName: job.data?.customerId ? (customerMap[job.data.customerId] ?? null) : null,
      retryStep: (job.data?.retryStep as number) ?? null,
      processAt: new Date(job.timestamp + (job.opts?.delay ?? 0)).toISOString(),
    });

    const pendingJobs = [
      ...replenDelayed.map((j) => formatJob(j, QUEUES.REPLENISHMENT)),
      ...retryDelayed.map((j) => formatJob(j, QUEUES.MESSAGE_RETRY)),
    ].sort((a, b) => new Date(a.processAt).getTime() - new Date(b.processAt).getTime());

    return { scheduledContacts, pendingJobs };
  }

  async upsertReplenishmentConfig(
    config: Partial<ReplenishmentFlowConfig>,
  ): Promise<ReplenishmentFlowConfig> {
    const merged = { ...DEFAULT_REPLENISHMENT_CONFIG, ...config };
    const json = JSON.stringify(merged);
    await this.prisma.automationRule.upsert({
      where: { key: AutomationKey.REPLENISHMENT_FLOW },
      create: {
        key: AutomationKey.REPLENISHMENT_FLOW,
        description: 'Cadência automática de reposição',
        config: json,
        isActive: true,
      },
      update: { config: json, isActive: true },
    });
    return merged;
  }
}
