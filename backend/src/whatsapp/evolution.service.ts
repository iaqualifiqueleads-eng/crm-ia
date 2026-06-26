import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingProvider, OutgoingMessage, SendResult } from '../messaging/messaging.types';

/**
 * Implementação do MessagingProvider usando Evolution API.
 *
 * Configuração necessária no .env:
 *   EVOLUTION_URL      = http://localhost:8085  (URL base da Evolution)
 *   EVOLUTION_API_KEY  = chave de admin da Evolution
 *   EVOLUTION_INSTANCE = nome da instância (chip conectado)
 *
 * Docs: https://doc.evolution-api.com/
 */
@Injectable()
export class EvolutionWhatsAppService implements MessagingProvider {
  readonly channel = 'whatsapp';
  private readonly logger = new Logger(EvolutionWhatsAppService.name);

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly instance: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('EVOLUTION_URL') ?? '').replace(/\/$/, '');
    this.apiKey = config.get<string>('EVOLUTION_API_KEY') ?? '';
    this.instance = config.get<string>('EVOLUTION_INSTANCE') ?? '';
    this.enabled = !!(this.baseUrl && this.apiKey && this.instance);
    if (!this.enabled) {
      this.logger.warn('Evolution não configurada (EVOLUTION_URL/API_KEY/INSTANCE). Mensagens vão falhar.');
    }
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.enabled) {
      return {
        externalId: 'no-config',
        sentAt: new Date(),
        status: 'FAILED',
        errorMessage: 'Evolution API não configurada',
      };
    }

    const url = `${this.baseUrl}/message/sendText/${encodeURIComponent(this.instance)}`;
    const body = {
      number: this.normalizeNumber(message.to),
      text: message.text,
    };

    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'apikey': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`Evolution send falhou ${res.status}: ${errText.slice(0, 200)}`);
        return {
          externalId: `err_${Date.now()}`,
          sentAt: new Date(),
          status: 'FAILED',
          errorMessage: `${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      const rawBody = await res.text();
      const data: any = rawBody ? JSON.parse(rawBody) : {};
      const externalId = data?.key?.id ?? data?.id ?? `evo_${Date.now()}`;
      this.logger.debug(`Evolution send ok (${Date.now() - t0}ms) → ${externalId}`);

      return {
        externalId: String(externalId),
        sentAt: new Date(),
        status: 'SENT',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Evolution send exception: ${msg}`);
      return {
        externalId: `exc_${Date.now()}`,
        sentAt: new Date(),
        status: 'FAILED',
        errorMessage: msg,
      };
    }
  }

  /**
   * Normaliza números brasileiros para o formato esperado pela Evolution:
   * só dígitos, com código do país.
   */
  private normalizeNumber(raw: string): string {
    let n = raw.replace(/\D/g, '');
    // Se começa com 0, retira (DDD com zero)
    if (n.startsWith('0')) n = n.slice(1);
    // Se tem 10 ou 11 dígitos (DDD + número BR), adiciona 55
    if (n.length === 10 || n.length === 11) n = `55${n}`;
    return n;
  }
}
