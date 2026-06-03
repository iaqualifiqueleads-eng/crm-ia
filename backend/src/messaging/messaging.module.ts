import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockMessagingService } from './mock-messaging.service';
import { EvolutionWhatsAppService } from '../whatsapp/evolution.service';
import { MESSAGING_PROVIDER, MessagingProvider } from './messaging.types';

/**
 * Resolução dinâmica do provider de mensagens:
 *
 *  - Se EVOLUTION_URL + EVOLUTION_API_KEY + EVOLUTION_INSTANCE estão setados,
 *    usa EvolutionWhatsAppService.
 *  - Caso contrário, cai pro MockMessagingService (logs only, útil em dev).
 */
@Global()
@Module({
  providers: [
    MockMessagingService,
    EvolutionWhatsAppService,
    {
      provide: MESSAGING_PROVIDER,
      inject: [ConfigService, EvolutionWhatsAppService, MockMessagingService],
      useFactory: (
        config: ConfigService,
        evo: EvolutionWhatsAppService,
        mock: MockMessagingService,
      ): MessagingProvider => {
        const ready = !!(
          config.get<string>('EVOLUTION_URL') &&
          config.get<string>('EVOLUTION_API_KEY') &&
          config.get<string>('EVOLUTION_INSTANCE')
        );
        return ready ? evo : mock;
      },
    },
  ],
  exports: [MESSAGING_PROVIDER, MockMessagingService, EvolutionWhatsAppService],
})
export class MessagingModule {}
