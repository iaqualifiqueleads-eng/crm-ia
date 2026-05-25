import { Global, Module } from '@nestjs/common';
import { MockAIService } from './mock-ai.service';
import { AI_PROVIDER } from './ai.types';

@Global()
@Module({
  providers: [
    MockAIService,
    {
      provide: AI_PROVIDER,
      useExisting: MockAIService,
    },
  ],
  exports: [AI_PROVIDER, MockAIService],
})
export class AiModule {}
