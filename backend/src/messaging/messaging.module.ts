import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockMessagingService } from './mock-messaging.service';
import { WahaWhatsAppService } from '../whatsapp/waha.service';
import { MESSAGING_PROVIDER, MessagingProvider } from './messaging.types';

/**
 * Resolução dinâmica do provider de mensagens:
 *
 *  - Se WAHA_URL + WAHA_API_KEY estão setados,
 *    usa WahaWhatsAppService.
 *  - Caso contrário, cai pro MockMessagingService (logs only, útil em dev).
 */
@Global()
@Module({
  providers: [
    MockMessagingService,
    WahaWhatsAppService,
    {
      provide: MESSAGING_PROVIDER,
      inject: [ConfigService, WahaWhatsAppService, MockMessagingService],
      useFactory: (
        config: ConfigService,
        waha: WahaWhatsAppService,
        mock: MockMessagingService,
      ): MessagingProvider => {
        const ready = !!(
          config.get<string>('WAHA_URL') &&
          config.get<string>('WAHA_API_KEY')
        );
        return ready ? waha : mock;
      },
    },
  ],
  exports: [MESSAGING_PROVIDER, MockMessagingService, WahaWhatsAppService],
})
export class MessagingModule {}