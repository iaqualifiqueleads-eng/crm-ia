import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  OrderFiltersDto,
} from './dto/orders.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getVisibleSalespersonIds, canManageUser } from '../common/scope.util';
import { buildPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastService,
  ) {}

  // -------------------------------------------------------
  // CREATE — registra pedido + recalcula previsão do cliente
  // -------------------------------------------------------
  async create(actor: CurrentUserPayload, dto: CreateOrderDto) {
    const customer = await this.assertCanTouchCustomer(actor, dto.customerId, 'edit');

    // Calcula subtotais e total
    const itemsData = dto.items.map((it) => {
      const subtotal = new Prisma.Decimal(it.quantity).times(it.unitPrice);
      return {
        productSku: it.productSku,
        productName: it.productName,
        quantity: new Prisma.Decimal(it.quantity),
        unit: it.unit ?? 'UN',
        unitPrice: new Prisma.Decimal(it.unitPrice),
        subtotal,
      };
    });
    const totalAmount = itemsData.reduce(
      (acc, it) => acc.plus(it.subtotal),
      new Prisma.Decimal(0),
    );
    const totalVolume = itemsData.reduce(
      (acc, it) => acc.plus(it.quantity),
      new Prisma.Decimal(0),
    );

    const order = await this.prisma.order.create({
      data: {
        customerId: customer.id,
        createdById: actor.sub,
        orderNumber: dto.orderNumber,
        orderedAt: dto.orderedAt,
        channel: dto.channel,
        totalAmount,
        totalVolume,
        notes: dto.notes,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    await this.prisma.customerEvent.create({
      data: {
        customerId: customer.id,
        authorId: actor.sub,
        type: 'ORDER_CREATED',
        title: `Novo pedido: R$ ${totalAmount.toFixed(2)}`,
        metadata: JSON.stringify({
          orderId: order.id,
          orderNumber: dto.orderNumber,
          orderedAt: dto.orderedAt,
        }),
      },
    });

    await this.forecast.recalculateForCustomer(customer.id);

    return order;
  }

  // -------------------------------------------------------
  // LIST
  // -------------------------------------------------------
  async findAll(actor: CurrentUserPayload, filters: OrderFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const visible = await getVisibleSalespersonIds(this.prisma, actor);

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
      customer: {
        deletedAt: null,
        salespersonId: { in: visible },
      },
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.channel ? { channel: filters.channel } : {}),
      ...(filters.search
        ? {
            OR: [
              { orderNumber: { contains: filters.search } },
              { customer: { companyName: { contains: filters.search } } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, companyName: true, salespersonId: true } },
          items: true,
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { orderedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  // -------------------------------------------------------
  // GET BY ID
  // -------------------------------------------------------
  async findOne(actor: CurrentUserPayload, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: {
        items: true,
        customer: { select: { id: true, companyName: true, salespersonId: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    const visible = await getVisibleSalespersonIds(this.prisma, actor);
    if (!visible.includes(order.customer.salespersonId)) {
      throw new ForbiddenException('Sem acesso a este pedido');
    }
    return order;
  }

  // -------------------------------------------------------
  // UPDATE — recalcula previsão
  // -------------------------------------------------------
  async update(actor: CurrentUserPayload, id: string, dto: UpdateOrderDto) {
    const current = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
      include: { customer: { select: { salespersonId: true } } },
    });
    if (!current) throw new NotFoundException('Pedido não encontrado');

    await this.assertCanTouchCustomer(actor, current.customerId, 'edit');

    if (dto.customerId && dto.customerId !== current.customerId) {
      throw new BadRequestException('Não é possível mover um pedido entre clientes');
    }

    let totalAmount = current.totalAmount;
    let totalVolume = current.totalVolume;
    let itemsReplace: any[] | null = null;

    if (dto.items) {
      itemsReplace = dto.items.map((it) => {
        const subtotal = new Prisma.Decimal(it.quantity).times(it.unitPrice);
        return {
          productSku: it.productSku,
          productName: it.productName,
          quantity: new Prisma.Decimal(it.quantity),
          unit: it.unit ?? 'UN',
          unitPrice: new Prisma.Decimal(it.unitPrice),
          subtotal,
        };
      });
      totalAmount = itemsReplace.reduce(
        (acc, it) => acc.plus(it.subtotal),
        new Prisma.Decimal(0),
      );
      totalVolume = itemsReplace.reduce(
        (acc, it) => acc.plus(it.quantity),
        new Prisma.Decimal(0),
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (itemsReplace) {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        await tx.orderItem.createMany({
          data: itemsReplace.map((it) => ({ ...it, orderId: id })),
        });
      }
      await tx.order.update({
        where: { id },
        data: {
          orderNumber: dto.orderNumber,
          orderedAt: dto.orderedAt,
          channel: dto.channel,
          notes: dto.notes,
          totalAmount,
          totalVolume,
        },
      });
    });

    await this.forecast.recalculateForCustomer(current.customerId);

    return this.findOne(actor, id);
  }

  // -------------------------------------------------------
  // DELETE — soft delete + recálculo
  // -------------------------------------------------------
  async remove(actor: CurrentUserPayload, id: string) {
    const current = await this.prisma.order.findFirst({
      where: { id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Pedido não encontrado');

    await this.assertCanTouchCustomer(actor, current.customerId, 'edit');

    await this.prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.forecast.recalculateForCustomer(current.customerId);
    return { success: true };
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  private async assertCanTouchCustomer(
    actor: CurrentUserPayload,
    customerId: string,
    mode: 'view' | 'edit',
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    if (actor.role === UserRole.SALESPERSON) {
      if (customer.salespersonId !== actor.sub) {
        throw new ForbiddenException('Sem acesso a este cliente');
      }
    } else {
      const can = await canManageUser(this.prisma, actor, customer.salespersonId);
      if (!can) throw new ForbiddenException('Sem acesso a este cliente');
    }
    return customer;
  }
}
