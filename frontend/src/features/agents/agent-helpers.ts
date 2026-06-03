import type { AiProvider } from '@/types/domain';

export const providerLabel: Record<AiProvider, string> = {
  CLAUDE: 'Anthropic',
  OPENAI: 'OpenAI',
  GEMINI: 'Google',
};

export const providerModelFamily: Record<AiProvider, string> = {
  CLAUDE: 'Claude',
  OPENAI: 'GPT',
  GEMINI: 'Gemini',
};

// Acentos tonais por provider — usados em chips e bordas.
// Mantém o sistema de cores: champagne (premium/destaque), forest (ok), neutral (calm).
export const providerTone: Record<AiProvider, 'champagne' | 'forest' | 'neutral'> = {
  CLAUDE: 'champagne',
  OPENAI: 'forest',
  GEMINI: 'neutral',
};

export function formatTools(csv?: string | null): string[] {
  if (!csv) return [];
  return csv.split(',').map((s) => s.trim()).filter(Boolean);
}

export function toolNameToLabel(name: string): string {
  const map: Record<string, string> = {
    register_order:                 'Registrar pedido',
    schedule_task:                  'Agendar tarefa',
    update_customer_notes:          'Anotar no perfil',
    transfer_to_human:              'Transferir p/ humano',
    update_replenishment_forecast:  'Ajustar previsão',
    mark_not_interested:            'Marcar como perdido',
  };
  return map[name] ?? name;
}
