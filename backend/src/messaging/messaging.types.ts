/**
 * Contrato genérico de canal de mensagem.
 *
 * Implementações:
 *  - MockMessagingService (Fase 1.2) — apenas registra que enviou
 *  - WhatsAppUnofficialService (Fase 3) — Baileys / Evolution API
 *
 * Quando a Fase 3 chegar, basta trocar o provider em MessagingModule.
 */
export interface OutgoingMessage {
  to: string;             // número do destinatário (E.164)
  text: string;
  externalRef?: string;   // id interno (interactionId) para correlacionar callbacks
  metadata?: Record<string, any>;
}

export interface SendResult {
  externalId: string;     // id da mensagem no provedor
  sentAt: Date;
  status: 'SENT' | 'FAILED';
  errorMessage?: string;
}

export interface IncomingMessage {
  externalId: string;
  from: string;
  text: string;
  receivedAt: Date;
  metadata?: Record<string, any>;
}

export interface MessagingProvider {
  /** Envia uma mensagem para o canal. */
  send(message: OutgoingMessage): Promise<SendResult>;

  /** Identifica o canal (whatsapp, sms, etc.) */
  readonly channel: string;
}

// Token DI
export const MESSAGING_PROVIDER = Symbol('MESSAGING_PROVIDER');
