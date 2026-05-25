import { Global, Module } from '@nestjs/common';
import { MockMessagingService } from './mock-messaging.service';
import { MESSAGING_PROVIDER } from './messaging.types';

@Global()
@Module({
  providers: [
    MockMessagingService,
    {
      provide: MESSAGING_PROVIDER,
      useExisting: MockMessagingService,
    },
  ],
  exports: [MESSAGING_PROVIDER, MockMessagingService],
})
export class MessagingModule {}
