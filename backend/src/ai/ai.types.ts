/**
 * Contrato genérico de provedor de IA (Claude / ChatGPT).
 *
 * Implementações:
 *  - MockAIService (Fase 1.2) — apenas renderiza o template com placeholders
 *  - ClaudeAIService (Fase 3) — chamada real para a API Anthropic
 *  - OpenAIService (Fase 3) — chamada real para a API OpenAI
 */
export interface RenderTemplateInput {
  /** Corpo do template com placeholders {{contactName}}, {{daysOverdue}}, etc. */
  template: string;
  /** Instrução opcional para a IA refinar o tom da mensagem antes de enviar. */
  aiInstructions?: string;
  /** Variáveis para interpolação de placeholders. */
  variables: Record<string, string | number>;
}

export interface AIResponse {
  text: string;
  model: string;
  tokensUsed?: number;
}

export interface AIProvider {
  renderMessage(input: RenderTemplateInput): Promise<AIResponse>;
  readonly name: string;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
