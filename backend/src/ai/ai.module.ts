import { Global, Module } from '@nestjs/common';
import { MockAIService } from './mock-ai.service';
import { ClaudeProvider } from './providers/claude.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { AIProviderRegistry } from './ai.registry';
import { AI_PROVIDER } from './ai.types';

@Global()
@Module({
  providers: [
    // Providers reais (Fase 3)
    ClaudeProvider,
    OpenAIProvider,
    GeminiProvider,
    AIProviderRegistry,

    // Mock legado — ainda usado pelo flow de templates/cadência
    MockAIService,
    { provide: AI_PROVIDER, useExisting: MockAIService },
  ],
  exports: [
    AIProviderRegistry,
    AI_PROVIDER,
    MockAIService,
  ],
})
export class AiModule {}
