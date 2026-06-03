import { Injectable, Logger } from '@nestjs/common';
import { LegacyAIRenderer, AIRenderResponse, RenderTemplateInput } from './ai.types';

/**
 * Implementação MOCK do renderer LEGADO — apenas substitui placeholders {{var}}.
 * Usada pelo flow de templates/cadência. Para conversas agênticas (Fase 3),
 * use AIProviderRegistry → ClaudeProvider/OpenAIProvider/GeminiProvider.
 */
@Injectable()
export class MockAIService implements LegacyAIRenderer {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAIService.name);

  async renderMessage(input: RenderTemplateInput): Promise<AIRenderResponse> {
    const text = this.interpolate(input.template, input.variables);

    if (input.aiInstructions) {
      this.logger.debug(
        `[MOCK ai] instruções ignoradas no mock: "${input.aiInstructions.slice(0, 60)}..."`,
      );
    }

    return {
      text,
      model: 'mock-v1',
      tokensUsed: 0,
    };
  }

  /**
   * Substitui placeholders no padrão {{nome}} pelos valores informados.
   */
  private interpolate(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_match, key: string) => {
      const value = vars[key];
      if (value === undefined || value === null) return '';
      return String(value);
    });
  }
}
