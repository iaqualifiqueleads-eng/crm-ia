/**
 * Contrato unificado para todos os providers (Claude, OpenAI, Gemini).
 */
import { AiProvider } from '@prisma/client';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ChatRequest {
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}

export interface ChatResponse {
  content: string;
  toolCalls: ToolCall[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  providerMessageId?: string;
}

export interface AIProvider {
  readonly providerName: AiProvider;
  readonly availableModels: string[];
  chat(request: ChatRequest): Promise<ChatResponse>;
}

// Compatibilidade: tipos antigos do mock
export interface RenderTemplateInput {
  template: string;
  aiInstructions?: string;
  variables: Record<string, string | number>;
}
export interface AIRenderResponse {
  text: string;
  model: string;
  tokensUsed?: number;
}

/** Contrato do renderer legado (usado pelo flow de templates/cadência). */
export interface LegacyAIRenderer {
  readonly name: string;
  renderMessage(input: RenderTemplateInput): Promise<AIRenderResponse>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
export const AI_PROVIDER_REGISTRY = Symbol('AI_PROVIDER_REGISTRY');
