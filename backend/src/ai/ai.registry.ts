import { Injectable } from '@nestjs/common';
import { AiProvider } from '@prisma/client';
import { AIProvider } from './ai.types';
import { ClaudeProvider } from './providers/claude.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { GeminiProvider } from './providers/gemini.provider';

@Injectable()
export class AIProviderRegistry {
  private readonly registry: Record<AiProvider, AIProvider>;

  constructor(
    claude: ClaudeProvider,
    openai: OpenAIProvider,
    gemini: GeminiProvider,
  ) {
    this.registry = {
      [AiProvider.CLAUDE]: claude,
      [AiProvider.OPENAI]: openai,
      [AiProvider.GEMINI]: gemini,
    };
  }

  get(provider: AiProvider): AIProvider {
    const p = this.registry[provider];
    if (!p) throw new Error(`Provider AI desconhecido: ${provider}`);
    return p;
  }

  list(): AIProvider[] {
    return Object.values(this.registry);
  }
}
