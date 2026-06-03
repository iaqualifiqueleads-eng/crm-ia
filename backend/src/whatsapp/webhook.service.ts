import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  InteractionDirection, InteractionStatus, InteractionType,
} from '@prisma/client';
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

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.AGENT_RESPONSE) private readonly agentQueue: Queue,
  ) {}

  /**
   * Entry point — recebe qualquer payload da Evolution e processa
   * só os eventos relevantes (messages.upsert).
   */
  async ingest(payload: any): Promise<{ accepted: boolean; reason?: string }> {
    const event: string = payload?.event ?? payload?.type ?? '';

    if (!event.includes('messages.upsert') && !event.includes('MESSAGES_UPSERT')) {
      this.logger.debug(`Ignorando evento: ${event}`);
      return { accepted: false, reason: 'event-not-supported' };
    }

    const parsed = this.parseMessage(payload);
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

    // Enfileira processamento pelo agente
    await this.agentQueue.add(
      JOBS.PROCESS_INBOUND,
      {
        customerId: customer.id,
        interactionId: inbound.id,
        text: parsed.text,
      },
      {
        // Anti-flood: máximo 1 job por cliente em até 5s (rate limit no worker)
        jobId: `inbound:${customer.id}:${inbound.id}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 2_000 },
      },
    );

    return { accepted: true };
  }

  // ---------------------------------------------------------
  // Parsing — Evolution tem 2 formatos comuns
  // ---------------------------------------------------------
  private parseMessage(payload: any): ParsedMessage | null {
    const data = payload?.data ?? payload;

    // Caso 1: messages.upsert do baileys (formato Evolution v2)
    //   data.key.remoteJid, data.key.id, data.key.fromMe
    //   data.message.conversation OU data.message.extendedTextMessage.text
    //   data.messageTimestamp
    if (data?.key) {
      const remoteJid: string = data.key.remoteJid ?? '';
      const fromNumber = remoteJid.split('@')[0];
      const text =
        data.message?.conversation ??
        data.message?.extendedTextMessage?.text ??
        data.message?.imageMessage?.caption ??
        '';

      return {
        externalId: String(data.key.id ?? `evo_${Date.now()}`),
        fromNumber,
        text,
        fromMe: !!data.key.fromMe,
        timestamp: data.messageTimestamp ? new Date(Number(data.messageTimestamp) * 1000) : undefined,
      };
    }

    // Caso 2: payload mais "limpo" que algumas instâncias enviam
    if (data?.from && (data?.body || data?.text)) {
      return {
        externalId: String(data.id ?? `evo_${Date.now()}`),
        fromNumber: String(data.from).replace(/\D/g, ''),
        text: data.body ?? data.text ?? '',
        fromMe: !!data.fromMe,
      };
    }

    return null;
  }

  /**
   * Encontra cliente cujo whatsapp/phone bate com o número recebido.
   * O número da Evolution vem só com dígitos (ex: 5527999998888).
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
