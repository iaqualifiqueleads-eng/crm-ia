/**
 * Nomes das filas BullMQ.
 */
export const QUEUES = {
  REPLENISHMENT: 'replenishment',
  MESSAGE_RETRY: 'message-retry',
  OVERDUE_ESCALATION: 'overdue-escalation',
} as const;

/**
 * Job names dentro de cada fila.
 */
export const JOBS = {
  // REPLENISHMENT
  DAILY_SCAN: 'daily-scan',                      // varre clientes e dispara mensagens iniciais
  SEND_REMINDER: 'send-reminder',                // envia a 1ª mensagem para um cliente específico

  // MESSAGE_RETRY
  CHECK_RETRY: 'check-retry',                    // verifica se cliente respondeu, senão reenvia

  // OVERDUE_ESCALATION
  DAILY_OVERDUE: 'daily-overdue',                // varre atrasos e notifica/cria tarefas urgentes
} as const;

// -----------------------------------------------------------
// Payloads dos jobs
// -----------------------------------------------------------

export interface SendReminderJobData {
  customerId: string;
  templateId: string;
  automationRef: string;        // ex: "REPL_2026-05-22_<customerId>"
}

export interface CheckRetryJobData {
  customerId: string;
  previousInteractionId: string;
  retryStep: 1 | 2 | 3;          // 1h -> 1, 3h -> 2, 24h -> 3
  automationRef: string;
}
