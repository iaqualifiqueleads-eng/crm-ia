import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { CampaignWorker } from './campaign.worker';
import { QUEUES } from '../workers/workers.types';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.CAMPAIGN }),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignWorker],
  exports: [CampaignsService],
})
export class CampaignsModule {}
