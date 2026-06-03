import { Injectable, Logger } from '@nestjs/common';
import {
  CustomerStatus, ForecastMode, OrderChannel,
  TaskPriority, TaskType,
  NotificationSeverity, UserRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ForecastService } from '../../forecast/forecast.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AgentTool, ToolExecutionContext, ToolExecutionResult } from './tool.types';

// ====================================================================
// 1) REGISTER_ORDER
// ====================================================================

@Injectable()
export class RegisterOrderTool implements AgentTool {
  readonly name = 'register_order';
  readonly description =
    'Registra um pedido de compra confirmado pelo cliente. Use SOMENTE quando o cliente confirmou explicitamente que quer fechar o pedido com produtos, quantidades e (opcionalmente) preços. Após chamar esta tool, transfira a conversa para um humano usando transfer_to_human para finalizar detalhes de pagamento e entrega.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        description: 'Lista de itens do pedido',
        items: {
          type: 'object',
          properties: {
            productName: { type: 'string', description: 'Nome do produto' },
            quantity:    { type: 'number', description: 'Quantidade' },
            unit:        { type: 'string', description: 'Unidade (UN, KG, M2, L, CX...)', default: 'UN' },
            unitPrice:   { type: 'number', description: 'Preço unitário em BRL. Use 0 se não souber.' },
          },
          required: ['productName', 'quantity'],
        },
      },
      notes: { type: 'string', description: 'Observações relevantes do pedido' },
    },
    required: ['items'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastService,
  ) {}

  async execute(args: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const items: any[] = args.items ?? [];
    if (items.length === 0) {
      return { summary: 'Pedido não registrado (sem itens)', data: { error: 'no_items' } };
    }

    const itemsData = items.map((it) => {
      const qty = Number(it.quantity ?? 0);
      const price = Number(it.unitPrice ?? 0);
      return {
        productName: String(it.productName).slice(0, 200),
        quantity: qty,
        unit: (it.unit ?? 'UN').slice(0, 10),
        unitPrice: price,
        subtotal: qty * price,
      };
    });
    const totalAmount = itemsData.reduce((acc, it) => acc + it.subtotal, 0);
    const totalVolume = itemsData.reduce((acc, it) => acc + it.quantity, 0);

    // O agente registra o pedido em nome do vendedor responsável
    const customer = await this.prisma.customer.findUnique({
      where: { id: ctx.customerId },
      select: { salespersonId: true, companyName: true },
    });
    if (!customer) throw new Error('Cliente não encontrado');

    const order = await this.prisma.order.create({
      data: {
        customerId: ctx.customerId,
        createdById: customer.salespersonId,
        orderedAt: new Date(),
        channel: OrderChannel.WHATSAPP,
        totalAmount,
        totalVolume,
        notes: `[Registrado por agente de IA]${args.notes ? '\n' + args.notes : ''}`,
        items: { create: itemsData },
      },
    });

    await this.prisma.customerEvent.create({
      data: {
        customerId: ctx.customerId,
        type: 'ORDER_CREATED_BY_AI',
        title: `Pedido registrado pela IA: R$ ${totalAmount.toFixed(2)}`,
        metadata: JSON.stringify({ orderId: order.id, items: itemsData.length }),
      },
    });

    if (ctx.source === 'conversation') {
      await this.forecast.recalculateForCustomer(ctx.customerId);
    }

    return {
      summary: `Pedido registrado · R$ ${totalAmount.toFixed(2)} · ${itemsData.length} ${itemsData.length === 1 ? 'item' : 'itens'}`,
      data: {
        orderId: order.id,
        totalAmount,
        itemCount: itemsData.length,
        currency: 'BRL',
      },
    };
  }
}

// ====================================================================
// 2) SCHEDULE_TASK
// ====================================================================

@Injectable()
export class ScheduleTaskTool implements AgentTool {
  readonly name = 'schedule_task';
  readonly description =
    'Agenda uma tarefa de follow-up no calendário do vendedor responsável pelo cliente. Útil quando o cliente pede para ligarem de volta em X dias, ou quando há um compromisso futuro a registrar.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      title:       { type: 'string', description: 'Título curto da tarefa' },
      description: { type: 'string', description: 'Descrição/contexto' },
      type: {
        type: 'string',
        enum: ['CALL', 'VISIT', 'FOLLOW_UP', 'MEETING'],
        description: 'Tipo de tarefa',
      },
      dueInDays:   { type: 'number', description: 'Em quantos dias deve ser feita (a partir de agora)' },
      priority: {
        type: 'string',
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        description: 'Prioridade',
        default: 'MEDIUM',
      },
    },
    required: ['title', 'type', 'dueInDays'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(args: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: ctx.customerId },
      select: { salespersonId: true },
    });
    if (!customer) throw new Error('Cliente não encontrado');

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + Math.max(0, Math.floor(Number(args.dueInDays ?? 1))));

    const task = await this.prisma.task.create({
      data: {
        title: String(args.title).slice(0, 200),
        description: args.description ? String(args.description) : null,
        type: (args.type ?? TaskType.FOLLOW_UP) as TaskType,
        priority: (args.priority ?? TaskPriority.MEDIUM) as TaskPriority,
        dueDate,
        assigneeId: customer.salespersonId,
        customerId: ctx.customerId,
        isAutomatic: true,
        automationRef: `AI_${ctx.agentId}_${Date.now()}`,
      },
    });

    return {
      summary: `Tarefa agendada: "${task.title}" para daqui ${args.dueInDays}d`,
      data: { taskId: task.id, dueDate: task.dueDate?.toISOString() },
    };
  }
}

// ====================================================================
// 3) UPDATE_CUSTOMER_NOTES
// ====================================================================

@Injectable()
export class UpdateCustomerNotesTool implements AgentTool {
  readonly name = 'update_customer_notes';
  readonly description =
    'Adiciona uma observação ao perfil do cliente. Use para registrar fatos relevantes mencionados pelo cliente (preferências, mudanças, particularidades). NÃO use para registrar a conversa em si — isso já é feito automaticamente.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      note: { type: 'string', description: 'Observação a anexar ao perfil' },
    },
    required: ['note'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(args: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: ctx.customerId },
      select: { notes: true },
    });
    const newNote = `[${new Date().toLocaleDateString('pt-BR')} · IA] ${args.note}`;
    const combined = customer?.notes
      ? `${customer.notes}\n\n${newNote}`
      : newNote;

    await this.prisma.customer.update({
      where: { id: ctx.customerId },
      data: { notes: combined.slice(0, 8000) },  // proteção contra notas gigantes
    });

    await this.prisma.customerEvent.create({
      data: {
        customerId: ctx.customerId,
        type: 'NOTE_ADDED_BY_AI',
        title: 'Anotação registrada pela IA',
        description: String(args.note).slice(0, 500),
      },
    });

    return {
      summary: `Anotação registrada: "${String(args.note).slice(0, 60)}..."`,
      data: { ok: true },
    };
  }
}

// ====================================================================
// 4) TRANSFER_TO_HUMAN
// ====================================================================

@Injectable()
export class TransferToHumanTool implements AgentTool {
  readonly name = 'transfer_to_human';
  readonly description =
    'Transfere a conversa para o vendedor humano. Use quando: (a) o cliente pede explicitamente para falar com alguém; (b) o cliente quer fechar uma compra (e você já chamou register_order); (c) você não consegue resolver a dúvida. Crie SEMPRE uma tarefa urgente para o vendedor com o motivo e um resumo da conversa.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      reason:  { type: 'string', description: 'Motivo objetivo da transferência (1-2 frases)' },
      summary: { type: 'string', description: 'Resumo do que foi conversado até agora (pra o vendedor não ter que ler tudo)' },
      urgency: { type: 'string', enum: ['MEDIUM', 'HIGH', 'URGENT'], default: 'HIGH' },
    },
    required: ['reason', 'summary'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async execute(args: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: ctx.customerId },
      select: { salespersonId: true, companyName: true },
    });
    if (!customer) throw new Error('Cliente não encontrado');

    const priority = (args.urgency ?? TaskPriority.HIGH) as TaskPriority;

    const task = await this.prisma.task.create({
      data: {
        title: `Atender ${customer.companyName} — IA solicitou transferência`,
        description: `MOTIVO: ${args.reason}\n\nRESUMO DA CONVERSA:\n${args.summary}`,
        type: TaskType.CALL,
        priority,
        dueDate: new Date(),
        assigneeId: customer.salespersonId,
        customerId: ctx.customerId,
        isAutomatic: true,
        automationRef: `AI_HANDOFF_${ctx.agentId}_${Date.now()}`,
      },
    });

    await this.notifications.create({
      userId: customer.salespersonId,
      title: `🤝 ${customer.companyName} aguarda você`,
      message: args.reason.slice(0, 200),
      severity: NotificationSeverity.WARNING,
      linkUrl: `/customers/${ctx.customerId}`,
      customerId: ctx.customerId,
      taskId: task.id,
    });

    return {
      summary: `Transferido para ${customer.salespersonId} (motivo: ${args.reason.slice(0, 50)}...)`,
      data: { taskId: task.id, salespersonId: customer.salespersonId },
      endsConversation: true,
      transferToHuman: true,
      transferReason: args.reason,
    };
  }
}

// ====================================================================
// 5) UPDATE_REPLENISHMENT_FORECAST
// ====================================================================

@Injectable()
export class UpdateReplenishmentForecastTool implements AgentTool {
  readonly name = 'update_replenishment_forecast';
  readonly description =
    'Ajusta a previsão de quando o cliente vai precisar repor o produto. Use SOMENTE quando o cliente disser explicitamente algo como "vou demorar mais X dias" ou "só vou precisar repor em Y semanas". Não use para chutar.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      newIntervalDays: { type: 'number', description: 'Novo intervalo de recompra em dias (ex: 45)' },
      reason: { type: 'string', description: 'Por que o cliente disse esse novo intervalo' },
    },
    required: ['newIntervalDays'],
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastService,
  ) {}

  async execute(args: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    const interval = Math.max(1, Math.floor(Number(args.newIntervalDays)));

    await this.prisma.customer.update({
      where: { id: ctx.customerId },
      data: {
        forecastMode: ForecastMode.MANUAL,
        manualIntervalDays: interval,
      },
    });

    await this.prisma.customerEvent.create({
      data: {
        customerId: ctx.customerId,
        type: 'FORECAST_UPDATED_BY_AI',
        title: `IA ajustou intervalo de reposição para ${interval} dias`,
        description: args.reason ? String(args.reason).slice(0, 500) : null,
      },
    });

    if (ctx.source === 'conversation') {
      await this.forecast.recalculateForCustomer(ctx.customerId);
    }

    return {
      summary: `Intervalo manual ajustado para ${interval} dias`,
      data: { intervalDays: interval },
    };
  }
}

// ====================================================================
// 6) MARK_NOT_INTERESTED
// ====================================================================

@Injectable()
export class MarkNotInterestedTool implements AgentTool {
  readonly name = 'mark_not_interested';
  readonly description =
    'Marca o cliente como CHURNED (perdido) e encerra a conversa. Use APENAS quando o cliente disser claramente que não quer mais ser contatado ou que parou de usar o produto.';
  readonly parameters = {
    type: 'object' as const,
    properties: {
      reason: { type: 'string', description: 'Motivo informado pelo cliente' },
    },
    required: ['reason'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async execute(args: any, ctx: ToolExecutionContext): Promise<ToolExecutionResult> {
    await this.prisma.customer.update({
      where: { id: ctx.customerId },
      data: { status: CustomerStatus.CHURNED },
    });

    await this.prisma.customerEvent.create({
      data: {
        customerId: ctx.customerId,
        type: 'CHURNED_BY_AI',
        title: 'Cliente marcado como perdido pela IA',
        description: String(args.reason).slice(0, 500),
      },
    });

    return {
      summary: `Cliente marcado como CHURNED (motivo: ${String(args.reason).slice(0, 50)}...)`,
      data: { newStatus: CustomerStatus.CHURNED },
      endsConversation: true,
    };
  }
}
