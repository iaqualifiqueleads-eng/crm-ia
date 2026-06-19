import {
  Injectable,
  Inject,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import {
  Prisma,
  InteractionStatus,
  InteractionType,
  InteractionDirection,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getVisibleSalespersonIds, canManageUser } from '../common/scope.util';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  CreateInteractionDto,
  IncomingMessageDto,
  InteractionFiltersDto,
} from './dto/interactions.dto';
import {
  MESSAGING_PROVIDER,
  MessagingProvider,
} from '../messaging/messaging.types';
import { AI_PROVIDER, LegacyAIRenderer } from '../ai/ai.types';

@Injectable()
export class InteractionsService {
  private readonly logger = new Logger(InteractionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(MESSAGING_PROVIDER) private readonly messaging: MessagingProvider,
    @Inject(AI_PROVIDER) private readonly ai: LegacyAIRenderer,
  ) {}

  // -------------------------------------------------------
  // Cria interação manualmente (nota ou registro de ligação)
  // -------------------------------------------------------
  async create(actor: CurrentUserPayload, dto: CreateInteractionDto) {
    await this.assertCustomerAccess(actor, dto.customerId);

    return this.prisma.interaction.create({
      data: {
        customerId: dto.customerId,
        type: dto.type,
        direction: dto.direction ?? InteractionDirection.OUTBOUND,
        content: dto.content,
        channel: dto.channel,
        templateId: dto.templateId,
        authorId: actor.sub,
        status: dto.type === InteractionType.NOTE
          ? InteractionStatus.SENT
          : InteractionStatus.PENDING,
        sentAt: dto.type === InteractionType.NOTE ? new Date() : undefined,
      },
      include: this.defaultInclude(),
    });
  }

  // -------------------------------------------------------
  // ENVIO PROGRAMADO POR AUTOMAÇÃO — usado pelo worker
  // 1. Cria interaction PENDING
  // 2. Renderiza template via IA (placeholders interpolados)
  // 3. Envia via messaging provider
  // 4. Atualiza status para SENT ou FAILED
  // 5. Retorna interaction
  // -------------------------------------------------------
  async sendAutomatedMessage(input: {
    customerId: string;
    templateId: string;
    automationRef: string;
  }) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
      include: { salesperson: { select: { id: true, name: true } } },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    if (!customer.whatsapp && !customer.phone) {
      throw new BadRequestException('Cliente sem número de contato');
    }
    const destination = customer.whatsapp ?? customer.phone!;

    const template = await this.prisma.messageTemplate.findFirst({
      where: { id: input.templateId, deletedAt: null, isActive: true },
    });
    if (!template) throw new NotFoundException('Template não encontrado ou inativo');

    // Renderiza
    const rendered = await this.ai.renderMessage({
      template: template.body,
      aiInstructions: template.aiInstructions ?? undefined,
      variables: this.buildTemplateVariables(customer),
    });

    // Cria interaction PENDING
    const interaction = await this.prisma.interaction.create({
      data: {
        customerId: customer.id,
        type: InteractionType.WHATSAPP_AI,
        direction: InteractionDirection.OUTBOUND,
        status: InteractionStatus.PENDING,
        content: rendered.text,
        channel: this.messaging.channel,
        templateId: template.id,
        automationRef: input.automationRef,
        jsonMetadata: JSON.stringify({
          aiModel: rendered.model,
          tokensUsed: rendered.tokensUsed,
        }),
      },
    });

    // Envia
    const result = await this.messaging.send({
      to: destination,
      text: rendered.text,
      externalRef: interaction.id,
      metadata: { customerId: customer.id, automationRef: input.automationRef },
    });

    // Atualiza
    const updated = await this.prisma.interaction.update({
      where: { id: interaction.id },
      data: {
        externalId: result.externalId,
        sentAt: result.sentAt,
        status: result.status === 'SENT' ? InteractionStatus.SENT : InteractionStatus.FAILED,
        failedReason: result.errorMessage,
      },
    });

    return updated;
  }

  // -------------------------------------------------------
  // INBOUND — recebe mensagem do cliente (webhook do WhatsApp)
  //
  // Importante: o histórico fica no CRM. Se o chip mudar,
  // não perdemos nada porque a fonte da verdade é o nosso DB.
  // -------------------------------------------------------
  async ingestIncoming(dto: IncomingMessageDto) {
    // Tenta achar o cliente por whatsapp/phone
    const customer = await this.prisma.customer.findFirst({
      where: {
        deletedAt: null,
        OR: [{ whatsapp: dto.from }, { phone: dto.from }],
      },
    });

    if (!customer) {
      this.logger.warn(`Mensagem recebida de número desconhecido: ${dto.from}`);
      // Mesmo assim registra para auditoria — sem customerId vinculado é impossível,
      // então criamos uma "interaction orfã" não é suportado pelo schema.
      // Retornamos avisando.
      return { matched: false, reason: 'Número não está vinculado a nenhum cliente.' };
    }

    let incoming: Awaited<ReturnType<typeof this.prisma.interaction.create>>;
    try {
      incoming = await this.prisma.interaction.create({
        data: {
          customerId: customer.id,
          type: InteractionType.WHATSAPP,
          direction: InteractionDirection.INBOUND,
          status: InteractionStatus.SENT,
          content: dto.text,
          channel: 'whatsapp',
          externalId: dto.externalId,
          sentAt: dto.receivedAt ?? new Date(),
        },
      });
    } catch (err: any) {
      // P2002 = unique constraint violation → webhook duplicado
      if (err?.code === 'P2002') {
        this.logger.warn(`Webhook duplicado ignorado — externalId: ${dto.externalId}`);
        const existing = await this.prisma.interaction.findFirst({ where: { externalId: dto.externalId } });
        return { matched: true, interactionId: existing!.id, customerId: customer.id, duplicate: true };
      }
      throw err;
    }

    // Procura a última interação OUTBOUND automática pendente de resposta
    // e marca como REPLIED
    const lastOutbound = await this.prisma.interaction.findFirst({
      where: {
        customerId: customer.id,
        direction: InteractionDirection.OUTBOUND,
        type: InteractionType.WHATSAPP_AI,
        status: { in: [InteractionStatus.SENT, InteractionStatus.DELIVERED, InteractionStatus.READ] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (lastOutbound) {
      await this.prisma.interaction.update({
        where: { id: lastOutbound.id },
        data: { status: InteractionStatus.REPLIED, repliedAt: new Date() },
      });
    }

    return { matched: true, interactionId: incoming.id, customerId: customer.id };
  }

  // -------------------------------------------------------
  // LIST por cliente (timeline)
  // -------------------------------------------------------
  async findAll(actor: CurrentUserPayload, filters: InteractionFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 50;

    // Sem customerId é uma listagem global — caro, restringe ao escopo
    const visible = await getVisibleSalespersonIds(this.prisma, actor);

    const where: Prisma.InteractionWhereInput = {
      customer: { deletedAt: null, salespersonId: { in: visible } },
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    if (filters.customerId) {
      await this.assertCustomerAccess(actor, filters.customerId);
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.interaction.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.interaction.count({ where }),
    ]);
    return buildPaginatedResult(data, total, page, limit);
  }

  async getCustomerTimeline(actor: CurrentUserPayload, customerId: string) {
    await this.assertCustomerAccess(actor, customerId);
    return this.prisma.interaction.findMany({
      where: { customerId },
      include: this.defaultInclude(),
      orderBy: { createdAt: 'asc' },
    });
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  private buildTemplateVariables(customer: any): Record<string, string | number> {
    return {
      companyName: customer.companyName ?? '',
      tradeName: customer.tradeName ?? customer.companyName ?? '',
      contactName: customer.contactName ?? '',
      daysOverdue: customer.daysOverdue ?? 0,
      lastOrderAt: customer.lastOrderAt
        ? new Date(customer.lastOrderAt).toLocaleDateString('pt-BR')
        : 'sem registro',
      nextReplenishmentAt: customer.nextReplenishmentAt
        ? new Date(customer.nextReplenishmentAt).toLocaleDateString('pt-BR')
        : '',
      salespersonName: customer.salesperson?.name ?? '',
    };
  }

  private defaultInclude() {
    return {
      template: { select: { id: true, name: true, trigger: true } },
      author: { select: { id: true, name: true } },
    };
  }

  private async assertCustomerAccess(actor: CurrentUserPayload, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    if (actor.role === UserRole.SALESPERSON) {
      if (customer.salespersonId !== actor.sub) {
        throw new ForbiddenException('Cliente fora do seu escopo');
      }
    } else {
      const can = await canManageUser(this.prisma, actor, customer.salespersonId);
      if (!can) throw new ForbiddenException('Cliente fora do seu escopo');
    }
  }
}
