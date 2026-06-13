import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { ForecastModule } from '../forecast/forecast.module';
import { QUEUES } from '../workers/workers.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.REPLENISHMENT }),
    ForecastModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}