import { AiProvider } from '@prisma/client';

/**
 * Tabela de preços por modelo (USD por 1 MILHÃO de tokens).
 * Snapshot de Q1 2026 — atualize conforme os providers mexem nos preços.
 *
 * Fontes:
 *  - Anthropic: https://www.anthropic.com/pricing#api
 *  - OpenAI:    https://openai.com/api/pricing
 *  - Google:    https://ai.google.dev/pricing
 */
export interface ModelPricing {
  input: number;   // USD per 1M input tokens
  output: number;  // USD per 1M output tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // ---------- Claude (Anthropic) ----------
  'claude-opus-4-7': { input: 15.00, output: 75.00 },
  'claude-opus-4-6': { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
  'claude-haiku-4-5': { input: 1.00, output: 5.00 },

  // ---------- OpenAI ----------
  'gpt-4.1-mini': { input: 0.40, output: 1.60 },
  'gpt-4o': { input: 2.50, output: 10.00 },
  'gpt-4o-mini': { input: 0.15, output: 0.60 },
  'gpt-4-turbo': { input: 10.00, output: 30.00 },
  'o1-mini': { input: 3.00, output: 12.00 },

  // ---------- Gemini (Google) ----------
  'gemini-2.5-pro': { input: 1.25, output: 5.00 },
  'gemini-2.5-flash': { input: 0.075, output: 0.30 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
};

/**
 * Modelos agrupados por provider (para o selector na UI).
 */
export interface ModelCatalogEntry {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

export const MODEL_CATALOG: Record<AiProvider, ModelCatalogEntry[]> = {
  CLAUDE: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', description: 'Equilíbrio — qualidade e custo', recommended: true },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', description: 'Mais rápido e barato' },
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', description: 'Máxima qualidade (caro)' },
  ],
  OPENAI: [
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', description: 'Mais consistente em instruções e extração de dados', recommended: true },
    { id: 'gpt-4o-mini', label: 'GPT-4o mini', description: 'Barato, rápido, ótimo em pt-BR', recommended: true },
    { id: 'gpt-4o', label: 'GPT-4o', description: 'Mais qualidade, mais caro' },
    { id: 'o1-mini', label: 'o1-mini', description: 'Raciocínio (analítico)' },
  ],
  GEMINI: [
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Muito barato, rápido', recommended: true },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Maior qualidade' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: 'Geração anterior' },
  ],
};

/**
 * Calcula custo em USD com base em tokens consumidos.
 */
export function calculateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(6));
}
