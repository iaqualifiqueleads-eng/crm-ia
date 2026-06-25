import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  InteractionDirection, InteractionStatus, InteractionType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES, JOBS } from './whatsapp.queue';

interface ParsedMessage {
  externalId: string;
  fromNumber: string;
  text: string;
  /** Se TRUE, a mensagem foi enviada PELO próprio chip (nosso outbound).
   *  Não devemos processar como inbound. */
  fromMe: boolean;
  timestamp?: Date;
}

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  private readonly wahaUrl: string;
  private readonly wahaApiKey: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUES.AGENT_RESPONSE) private readonly agentQueue: Queue,
  ) {
    this.wahaUrl = (config.get<string>('WAHA_URL') ?? '').replace(/\/$/, '');
    this.wahaApiKey = config.get<string>('WAHA_API_KEY') ?? '';
  }

  /**
   * Entry point — recebe qualquer payload da WAHA e processa
   * só os eventos relevantes (message, message.any).
   */
  async ingest(payload: any): Promise<{ accepted: boolean; reason?: string }> {
    const event: string = payload?.event ?? '';

    // WAHA envia 'message' ou 'message.any' para mensagens de chat
    if (event !== 'message' && event !== 'message.any') {
      this.logger.debug(`Ignorando evento WAHA: ${event}`);
      return { accepted: false, reason: 'event-not-supported' };
    }

    const parsed = await this.parseMessage(payload);
    if (!parsed) {
      this.logger.debug('Payload de mensagem não reconhecido — ignorado');
      return { accepted: false, reason: 'unparseable' };
    }

    // Mensagens enviadas PELO PRÓPRIO CHIP voltam no webhook como fromMe=true.
    // Não devem ser processadas como inbound — isso causaria loop.
    if (parsed.fromMe) {
      this.logger.debug(`Ignorando mensagem own (fromMe) ${parsed.externalId}`);
      return { accepted: false, reason: 'from-me' };
    }

    // Texto vazio (ex: status de leitura, áudios sem transcrição, mídia)
    if (!parsed.text?.trim()) {
      this.logger.debug(`Ignorando mensagem sem texto ${parsed.externalId}`);
      return { accepted: false, reason: 'empty-text' };
    }

    // Idempotência — se já processamos essa mensagem, sai
    if (parsed.externalId) {
      const existing = await this.prisma.interaction.findFirst({
        where: { externalId: parsed.externalId },
        select: { id: true },
      });
      if (existing) {
        return { accepted: false, reason: 'duplicate' };
      }
    }

    // Encontra o cliente pelo número
    const customer = await this.findCustomerByNumber(parsed.fromNumber);
    if (!customer) {
      this.logger.warn(`Mensagem de número não cadastrado: ${parsed.fromNumber}`);
      return { accepted: false, reason: 'unknown-customer' };
    }

    // Cria interaction inbound
    const inbound = await this.prisma.interaction.create({
      data: {
        customerId: customer.id,
        type: InteractionType.WHATSAPP,
        direction: InteractionDirection.INBOUND,
        status: InteractionStatus.SENT,
        content: parsed.text,
        channel: 'whatsapp',
        externalId: parsed.externalId,
        sentAt: parsed.timestamp ?? new Date(),
      },
    });

    // Marca a última outbound como REPLIED (encerra ciclo de retry da cadência)
    await this.markLastOutboundAsReplied(customer.id);

    // Acumula o texto no Redis para agregação
    const existing = await this.agentQueue.getJob(`debounce-${customer.id}`);

    // Busca textos anteriores acumulados no Redis (via BullMQ job data)
    let accumulatedText = parsed.text;
    if (existing) {
      // Job ainda não executou — cancela e agrega o texto
      const previousText = existing.data?.text ?? '';
      accumulatedText = previousText + '\n' + parsed.text;
      await existing.remove();
    }

    // Agenda (ou re-agenda) o job com delay de 15s
    await this.agentQueue.add(
      JOBS.PROCESS_INBOUND,
      {
        customerId: customer.id,
        interactionId: inbound.id,
        text: accumulatedText,
      },
      {
        jobId: `debounce-${customer.id}`,
        delay: 15_000, // 15 segundos de silêncio
        attempts: 1,
      },
    );

    return { accepted: true };
  }

  // ---------------------------------------------------------
  // Parsing — WAHA tem formato consistente
  // ---------------------------------------------------------
  /**
   * Refatorado para WAHA
   * 
   * WAHA coloca os dados da mensagem no campo 'payload':
   * - payload.id -> ID da mensagem
   * - payload.from -> número@c.us
   * - payload.body -> texto da mensagem
   * - payload.fromMe -> boolean
   * - payload.timestamp -> unix timestamp (segundos)
   */
  private async parseMessage(payload: any): Promise<ParsedMessage | null> {
    const data = payload?.payload;
    if (!data) return null;

    let fromRaw = String(data.from || '');

    if (fromRaw.endsWith('@lid')) {
      // NOWEB: tenta _data.key.remoteJidAlt
      const remoteJidAlt = data?._data?.key?.remoteJidAlt;
      if (remoteJidAlt) {
        fromRaw = remoteJidAlt;
      } else if (this.wahaUrl) {
        // WEBJS: resolve LID via API do WAHA
        fromRaw = await this.resolveLidToPhone(fromRaw) ?? fromRaw;
      }
    }

    const fromNumber = fromRaw.split('@')[0];

    return {
      externalId: String(data.id || `waha_${Date.now()}`),
      fromNumber,
      text: data.body ?? '',
      fromMe: !!data.fromMe,
      timestamp: data.timestamp ? new Date(data.timestamp * 1000) : undefined,
    };
  }

  /**
   * Chama a API do WAHA para resolver um LID (@lid) ao número de telefone real.
   * Retorna o número no formato "5527XXXXXXXXX@c.us" ou null se não resolver.
   */
  private async resolveLidToPhone(lid: string): Promise<string | null> {
    try {
      const res = await fetch(
        `${this.wahaUrl}/api/default/contacts/${encodeURIComponent(lid)}`,
        { headers: { 'X-Api-Key': this.wahaApiKey } },
      );
      if (!res.ok) return null;
      const contact: any = await res.json();
      // WAHA retorna o número real em 'id' ou 'number'
      const phone = contact?.id ?? contact?.number ?? null;
      if (phone) this.logger.debug(`LID ${lid} resolvido para ${phone}`);
      return phone;
    } catch (err) {
      this.logger.warn(`Falha ao resolver LID ${lid}: ${err}`);
      return null;
    }
  }

  /**
   * Encontra cliente cujo whatsapp/phone bate com o número recebido.
   * O número da WAHA vem só com dígitos (ex: 5527999998888).
   */
  private async findCustomerByNumber(number: string) {
    const digits = number.replace(/\D/g, '');
    // Tenta match exato em whatsapp ou phone (após retirar não-dígitos)
    // MySQL não tem REGEXP_REPLACE simples, então fazemos com LIKE pelo final
    const lastTen = digits.slice(-10); // últimos 10 dígitos (DDD + número)

    return this.prisma.customer.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { whatsapp: { contains: lastTen } },
          { phone: { contains: lastTen } },
        ],
      },
      select: { id: true, salespersonId: true, companyName: true },
    });
  }

  private async markLastOutboundAsReplied(customerId: string) {
    const last = await this.prisma.interaction.findFirst({
      where: {
        customerId,
        direction: InteractionDirection.OUTBOUND,
        status: { in: [InteractionStatus.SENT, InteractionStatus.DELIVERED, InteractionStatus.READ] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (last) {
      await this.prisma.interaction.update({
        where: { id: last.id },
        data: { status: InteractionStatus.REPLIED, repliedAt: new Date() },
      });
    }
  }
}