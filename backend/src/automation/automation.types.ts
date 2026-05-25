/**
 * Chaves bem conhecidas em AutomationRule.key
 */
export enum AutomationKey {
  REPLENISHMENT_FLOW = 'REPLENISHMENT_FLOW',
}

/**
 * Configuração do fluxo de reposição.
 * Tudo serializado como JSON no campo `config` de AutomationRule.
 */
export interface ReplenishmentFlowConfig {
  /** Ativa/desativa o envio automático. */
  enabled: boolean;
  /** Quantos dias ANTES da data prevista a IA inicia o contato? (0 = no dia) */
  remindBeforeDays: number;
  /** Intervalo (em horas) para 1ª, 2ª, 3ª tentativas após a inicial */
  retryDelaysHours: [number, number, number]; // [1, 3, 24] por padrão
  /** Dias de atraso até gerar tarefa urgente para o vendedor. */
  overdueTaskAfterDays: number;
  /** Dias de atraso até notificar o supervisor e o gerente. */
  escalateToManagementAfterDays: number;
  /** Template default para o primeiro envio (uuid). */
  defaultReminderTemplateId?: string;
  /** Template para mensagens de retry (1h, 3h, 24h). */
  retryTemplateIds?: {
    retry1h?: string;
    retry3h?: string;
    retry24h?: string;
  };
  /** Template para mensagem de cliente atrasado. */
  overdueTemplateId?: string;
}

export const DEFAULT_REPLENISHMENT_CONFIG: ReplenishmentFlowConfig = {
  enabled: true,
  remindBeforeDays: 0,
  retryDelaysHours: [1, 3, 24],
  overdueTaskAfterDays: 1,
  escalateToManagementAfterDays: 3,
};
