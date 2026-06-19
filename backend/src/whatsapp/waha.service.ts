import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingProvider, OutgoingMessage, SendResult } from '../messaging/messaging.types';

/**
 * Implementação do MessagingProvider usando WAHA (WhatsApp HTTP API).
 *
 * Configuração necessária no .env:
 *   WAHA_URL      = http://localhost:3000  (URL base da WAHA)
 *   WAHA_API_KEY  = chave de segurança da WAHA
 *
 * Docs: https://waha.dev/docs/
 */
@Injectable()
export class WahaWhatsAppService implements MessagingProvider {
  readonly channel = 'whatsapp';
  private readonly logger = new Logger(WahaWhatsAppService.name);

  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    this.baseUrl = (config.get<string>('WAHA_URL') ?? '').replace(/\/$/, '');
    this.apiKey = config.get<string>('WAHA_API_KEY') ?? '';
    this.enabled = !!(this.baseUrl && this.apiKey);

    if (!this.enabled) {
      this.logger.warn('WAHA não configurado (WAHA_URL/WAHA_API_KEY). Mensagens vão falhar.');
    }
  }

  async send(message: OutgoingMessage): Promise<SendResult> {
    if (!this.enabled) {
      return {
        externalId: 'no-config',
        sentAt: new Date(),
        status: 'FAILED',
        errorMessage: 'WAHA API não configurada',
      };
    }

    const chatId = await this.resolveChatId(message.to);
    const url = `${this.baseUrl}/api/sendText`;
    const body = {
      chatId,
      text: message.text,
      session: 'default',
    };

    const t0 = Date.now();
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'X-Api-Key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        this.logger.error(`WAHA send falhou ${res.status}: ${errText.slice(0, 200)}`);
        return {
          externalId: `err_${Date.now()}`,
          sentAt: new Date(),
          status: 'FAILED',
          errorMessage: `${res.status}: ${errText.slice(0, 200)}`,
        };
      }

      const data: any = await res.json();
      // WAHA retorna o ID da mensagem no campo 'id'
      const externalId = data?.id ?? `waha_${Date.now()}`;
      this.logger.debug(`WAHA send ok (${Date.now() - t0}ms) → ${externalId}`);

      return {
        externalId: String(externalId),
        sentAt: new Date(),
        status: 'SENT',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`WAHA send exception: ${msg}`);
      return {
        externalId: `exc_${Date.now()}`,
        sentAt: new Date(),
        status: 'FAILED',
        errorMessage: msg,
      };
    }
  }

  /**
   * Resolve o chatId correto para o número:
   * - Contas WhatsApp Business usam LID (@lid) em vez de @c.us
   * - Consulta o endpoint de LIDs do WAHA; se encontrar, usa o LID
   * - Caso contrário, cai no formato padrão @c.us
   */
  private async resolveChatId(raw: string): Promise<string> {
    const phone = this.normalizeNumber(raw).replace('@c.us', '');
    try {
      const res = await fetch(
        `${this.baseUrl}/api/default/lids/pn/${phone}`,
        { headers: { 'X-Api-Key': this.apiKey } },
      );
      if (res.ok) {
        const data: any = await res.json();
        const lid = data?.lid ?? data?.id;
        if (lid) {
          const chatId = lid.endsWith('@lid') ? lid : `${lid}@lid`;
          this.logger.debug(`LID resolvido para ${phone}: ${chatId}`);
          return chatId;
        }
      }
    } catch (err) {
      this.logger.warn(`Falha ao consultar LID para ${phone}: ${err}`);
    }
    // Fallback para @c.us (número pessoal ou LID não encontrado)
    return `${phone}@c.us`;
  }

  /**
   * Normaliza números brasileiros para o formato esperado pela WAHA:
   * 5527999998888@c.us
   */
  private normalizeNumber(raw: string): string {
    let n = raw.replace(/\D/g, '');
    if (n.startsWith('0')) n = n.slice(1);
    if (n.length === 10 || n.length === 11) n = `55${n}`;
    if (!n.endsWith('@c.us')) n = `${n}@c.us`;
    return n;
  }
}