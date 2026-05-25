import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MessagingProvider, OutgoingMessage, SendResult } from './messaging.types';

/**
 * Implementação MOCK — somente loga e retorna sucesso.
 * Serve para desenvolver e testar todo o pipeline (templates, retry, histórico)
 * sem precisar de WhatsApp real.
 */
@Injectable()
export class MockMessagingService implements MessagingProvider {
  readonly channel = 'whatsapp';
  private readonly logger = new Logger(MockMessagingService.name);

  async send(message: OutgoingMessage): Promise<SendResult> {
    const externalId = `mock_${randomUUID()}`;
    this.logger.log(
      `[MOCK send] to=${message.to} externalId=${externalId} text="${message.text.slice(0, 80)}${message.text.length > 80 ? '...' : ''}"`,
    );

    // Simula falha aleatória de ~3% para exercitar retry
    const shouldFail = Math.random() < 0.03;
    if (shouldFail) {
      this.logger.warn(`[MOCK send] falhou intencionalmente para externalId=${externalId}`);
      return {
        externalId,
        sentAt: new Date(),
        status: 'FAILED',
        errorMessage: 'Falha simulada do canal mock',
      };
    }

    return {
      externalId,
      sentAt: new Date(),
      status: 'SENT',
    };
  }
}
