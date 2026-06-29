import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessagingProvider, OutgoingMessage, SendResult } from '../messaging/messaging.types';

const FETCH_TIMEOUT_MS = 15_000;

function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

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

    this.logger.log(`WAHA sendText → chatId=${chatId} url=${url}`);
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(url, {
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

      const rawBody = await res.text();
      this.logger.log(`WAHA send raw response (${res.status}): "${rawBody.slice(0, 300)}"`);
      const data: any = rawBody ? JSON.parse(rawBody) : {};
      const externalId = data?.id ?? `waha_${Date.now()}`;
      this.logger.log(`WAHA send ok (${Date.now() - t0}ms) → externalId=${externalId}`);

      return {
        externalId: String(externalId),
        sentAt: new Date(),
        status: 'SENT',
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.includes('abort') || msg.includes('AbortError');
      this.logger.error(`WAHA send ${isTimeout ? 'TIMEOUT' : 'exception'}: ${msg}`);
      return {
        externalId: `exc_${Date.now()}`,
        sentAt: new Date(),
        status: 'FAILED',
        errorMessage: isTimeout ? `Timeout após ${FETCH_TIMEOUT_MS}ms` : msg,
      };
    }
  }

  private async resolveChatId(raw: string): Promise<string> {
    const phone = this.normalizeNumber(raw).replace('@c.us', '');
    try {
      const res = await fetchWithTimeout(
        `${this.baseUrl}/api/default/lids/pn/${phone}`,
        { headers: { 'X-Api-Key': this.apiKey } },
      );
      if (res.ok) {
        const rawLid = await res.text();
        const data: any = rawLid ? JSON.parse(rawLid) : {};
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
    return `${phone}@c.us`;
  }

  private normalizeNumber(raw: string): string {
    let n = raw.replace(/\D/g, '');
    if (n.startsWith('0')) n = n.slice(1);
    if (n.length === 10 || n.length === 11) n = `55${n}`;
    if (!n.endsWith('@c.us')) n = `${n}@c.us`;
    return n;
  }
}
