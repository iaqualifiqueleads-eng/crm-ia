import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WhatsAppWebhookService } from './webhook.service';
import { WhatsAppController } from './whatsapp.controller';
import { AgentResponseWorker } from './agent-response.worker';
import { QUEUES } from './whatsapp.queue';

/**
 * O EvolutionWhatsAppService é provido pelo MessagingModule (Global).
 * Aqui apenas registramos webhook + worker que processa inbound.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUES.AGENT_RESPONSE }),
  ],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppWebhookService,
    AgentResponseWorker,
  ],
  exports: [WhatsAppWebhookService],
})
export class WhatsAppModule {}
