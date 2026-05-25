import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUES, JOBS } from './workers.types';

/**
 * No boot da aplicação, garante que os jobs diários estão agendados.
 * BullMQ deduplica via `repeat.key`, então é seguro chamar a cada start.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectQueue(QUEUES.REPLENISHMENT) private readonly replenishment: Queue,
    @InjectQueue(QUEUES.OVERDUE_ESCALATION) private readonly overdue: Queue,
  ) {}

  async onApplicationBootstrap() {
    // Daily scan de reposição — todo dia às 09:00 (horário do servidor)
    await this.replenishment.add(
      JOBS.DAILY_SCAN,
      {},
      {
        repeat: { pattern: '0 9 * * *' },
        jobId: 'cron:replenishment-daily-scan',
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    // Overdue escalation — todo dia às 09:15
    await this.overdue.add(
      JOBS.DAILY_OVERDUE,
      {},
      {
        repeat: { pattern: '15 9 * * *' },
        jobId: 'cron:overdue-daily',
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    this.logger.log('Jobs cron registrados: replenishment 09:00, overdue 09:15');
  }
}
