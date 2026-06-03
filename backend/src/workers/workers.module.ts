import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ReplenishmentWorker } from './replenishment.worker';
import { MessageRetryWorker } from './message-retry.worker';
import { OverdueEscalationWorker } from './overdue-escalation.worker';
import { SchedulerService } from './scheduler.service';
import { QUEUES } from './workers.types';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: config.getOrThrow<number>('REDIS_PORT'),
        },
        defaultJobOptions: {
          removeOnComplete: { count: 1000, age: 60 * 60 * 24 * 7 }, // 7 dias
          removeOnFail: { count: 1000, age: 60 * 60 * 24 * 30 },    // 30 dias
        },
      }),
    }),
    BullModule.registerQueue(
      { name: QUEUES.REPLENISHMENT },
      { name: QUEUES.MESSAGE_RETRY },
      { name: QUEUES.OVERDUE_ESCALATION },
    ),
  ],
  providers: [
    ReplenishmentWorker,
    MessageRetryWorker,
    OverdueEscalationWorker,
    SchedulerService,
  ],
  exports: [BullModule, SchedulerService],
})
export class WorkersModule {}
