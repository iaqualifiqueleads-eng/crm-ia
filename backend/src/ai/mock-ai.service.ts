import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, AIResponse, RenderTemplateInput } from './ai.types';

/**
 * Implementação MOCK — apenas substitui placeholders {{var}} pelos valores.
 * Não chama IA real. Permite testar todo o pipeline de envio de mensagens.
 *
 * Quando trocar para Claude/GPT, a única coisa que muda é esta classe —
 * o pipeline (templates, fila, retry) permanece intacto.
 */
@Injectable()
export class MockAIService implements AIProvider {
  readonly name = 'mock';
  private readonly logger = new Logger(MockAIService.name);

  async renderMessage(input: RenderTemplateInput): Promise<AIResponse> {
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
   * Placeholders não resolvidos viram string vazia.
   */
  private interpolate(template: string, vars: Record<string, string | number>): string {
    return template.replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_match, key: string) => {
      const value = vars[key];
      if (value === undefined || value === null) return '';
      return String(value);
    });
  }
}
