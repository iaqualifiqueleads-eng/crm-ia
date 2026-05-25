import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma, UserRole, ForecastMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  TransferCustomerDto,
  CustomerFiltersDto,
} from './dto/customers.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getVisibleSalespersonIds, canManageUser } from '../common/scope.util';
import { buildPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastService,
  ) {}

  // -------------------------------------------------------
  // CREATE
  // -------------------------------------------------------
  async create(actor: CurrentUserPayload, dto: CreateCustomerDto) {
    const salespersonId = await this.resolveSalespersonId(actor, dto.salespersonId);

    if (dto.cnpj) {
      const existing = await this.prisma.customer.findUnique({ where: { cnpj: dto.cnpj } });
      if (existing) throw new ConflictException('Já existe cliente com este CNPJ');
    }

    const customer = await this.prisma.customer.create({
      data: {
        companyName: dto.companyName,
        tradeName: dto.tradeName,
        cnpj: dto.cnpj,
        email: dto.email,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        contactName: dto.contactName,
        contactRole: dto.contactRole,
        status: dto.status,
        origin: dto.origin,
        tags: dto.tags,
        notes: dto.notes,
        salespersonId,
        forecastMode: dto.forecastMode ?? ForecastMode.AUTO,
        manualIntervalDays: dto.manualIntervalDays,
      },
    });

    await this.prisma.customerEvent.create({
      data: {
        customerId: customer.id,
        authorId: actor.sub,
        type: 'CREATED',
        title: 'Cliente cadastrado',
        description: `Cadastrado por ${actor.email}`,
      },
    });

    // Já tenta calcular previsão — ainda sem pedidos vai zerar, mas mantém o cache consistente
    await this.forecast.recalculateForCustomer(customer.id);

    return this.findOneRaw(customer.id);
  }

  // -------------------------------------------------------
  // LIST
  // -------------------------------------------------------
  async findAll(actor: CurrentUserPayload, filters: CustomerFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const visible = await getVisibleSalespersonIds(this.prisma, actor);

    // Se o filtro pediu um salespersonId específico, intersecta com o escopo visível
    let salespersonFilter: Prisma.StringFilter | undefined;
    if (filters.salespersonId) {
      if (!visible.includes(filters.salespersonId)) {
        throw new ForbiddenException('Vendedor fora do seu escopo');
      }
      salespersonFilter = { equals: filters.salespersonId };
    } else {
      salespersonFilter = { in: visible };
    }

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      salespersonId: salespersonFilter,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.onlyOverdue ? { daysOverdue: { gt: 0 } } : {}),
      ...(filters.search
        ? {
            OR: [
              { companyName: { contains: filters.search } },
              { tradeName: { contains: filters.search } },
              { cnpj: { contains: filters.search } },
              { contactName: { contains: filters.search } },
              { email: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        include: {
          salesperson: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: [{ daysOverdue: 'desc' }, { companyName: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.customer.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  // -------------------------------------------------------
  // GET BY ID — com timeline básica
  // -------------------------------------------------------
  async findOne(actor: CurrentUserPayload, id: string) {
    await this.assertCanView(actor, id);
    return this.findOneRaw(id);
  }

  async getTimeline(actor: CurrentUserPayload, id: string, limit = 50) {
    await this.assertCanView(actor, id);
    return this.prisma.customerEvent.findMany({
      where: { customerId: id },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
  }

  // -------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------
  async update(actor: CurrentUserPayload, id: string, dto: UpdateCustomerDto) {
    const current = await this.assertCanEdit(actor, id);

    // Mudança de vendedor responsável vai pela rota de transferência
    if (dto.salespersonId && dto.salespersonId !== current.salespersonId) {
      throw new BadRequestException(
        'Para mudar o vendedor responsável, use o endpoint /customers/:id/transfer',
      );
    }

    if (dto.cnpj && dto.cnpj !== current.cnpj) {
      const exists = await this.prisma.customer.findFirst({
        where: { cnpj: dto.cnpj, id: { not: id } },
      });
      if (exists) throw new ConflictException('CNPJ já cadastrado em outro cliente');
    }

    const statusChanged = dto.status && dto.status !== current.status;
    const forecastChanged =
      (dto.forecastMode && dto.forecastMode !== current.forecastMode) ||
      (dto.manualIntervalDays !== undefined &&
        dto.manualIntervalDays !== current.manualIntervalDays);

    const updated = await this.prisma.customer.update({
      where: { id },
      data: {
        companyName: dto.companyName,
        tradeName: dto.tradeName,
        cnpj: dto.cnpj,
        email: dto.email,
        phone: dto.phone,
        whatsapp: dto.whatsapp,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        zipCode: dto.zipCode,
        contactName: dto.contactName,
        contactRole: dto.contactRole,
        status: dto.status,
        origin: dto.origin,
        tags: dto.tags,
        notes: dto.notes,
        forecastMode: dto.forecastMode,
        manualIntervalDays: dto.manualIntervalDays,
      },
    });

    if (statusChanged) {
      await this.prisma.customerEvent.create({
        data: {
          customerId: id,
          authorId: actor.sub,
          type: 'STATUS_CHANGED',
          title: `Status: ${current.status} → ${dto.status}`,
        },
      });
    }

    if (forecastChanged) {
      await this.prisma.customerEvent.create({
        data: {
          customerId: id,
          authorId: actor.sub,
          type: 'FORECAST_UPDATED',
          title: 'Previsão de recompra ajustada',
          metadata: JSON.stringify({
            forecastMode: dto.forecastMode,
            manualIntervalDays: dto.manualIntervalDays,
          }),
        },
      });
      await this.forecast.recalculateForCustomer(id);
    }

    return updated;
  }

  // -------------------------------------------------------
  // TRANSFER — só supervisor (entre seus subordinados) ou manager
  // -------------------------------------------------------
  async transfer(actor: CurrentUserPayload, id: string, dto: TransferCustomerDto) {
    if (actor.role === UserRole.SALESPERSON) {
      throw new ForbiddenException('Vendedores não podem transferir clientes');
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, salespersonId: true, companyName: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    // O ator precisa ter o vendedor ORIGEM no seu escopo
    const canTouchOrigin = await canManageUser(this.prisma, actor, customer.salespersonId);
    if (!canTouchOrigin) {
      throw new ForbiddenException('Sem permissão sobre o vendedor atual deste cliente');
    }

    // E também o vendedor DESTINO
    const canTouchTarget = await canManageUser(this.prisma, actor, dto.toSalespersonId);
    if (!canTouchTarget) {
      throw new ForbiddenException('Sem permissão sobre o vendedor de destino');
    }

    const target = await this.prisma.user.findFirst({
      where: {
        id: dto.toSalespersonId,
        isActive: true,
        deletedAt: null,
        role: { in: [UserRole.SALESPERSON, UserRole.SUPERVISOR, UserRole.MANAGER] },
      },
    });
    if (!target) throw new BadRequestException('Vendedor de destino inválido');

    if (customer.salespersonId === dto.toSalespersonId) {
      throw new BadRequestException('Cliente já pertence a este vendedor');
    }

    await this.prisma.$transaction([
      this.prisma.customer.update({
        where: { id },
        data: { salespersonId: dto.toSalespersonId },
      }),
      this.prisma.customerTransfer.create({
        data: {
          customerId: id,
          fromSalespersonId: customer.salespersonId,
          toSalespersonId: dto.toSalespersonId,
          transferredById: actor.sub,
          reason: dto.reason,
        },
      }),
      this.prisma.customerEvent.create({
        data: {
          customerId: id,
          authorId: actor.sub,
          type: 'TRANSFERRED',
          title: `Carteira transferida para ${target.name}`,
          description: dto.reason,
          metadata: JSON.stringify({
            from: customer.salespersonId,
            to: dto.toSalespersonId,
          }),
        },
      }),
    ]);

    return { success: true };
  }

  // -------------------------------------------------------
  // SOFT DELETE
  // -------------------------------------------------------
  async remove(actor: CurrentUserPayload, id: string) {
    await this.assertCanEdit(actor, id);
    await this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // -------------------------------------------------------
  // Helpers internos
  // -------------------------------------------------------
  private findOneRaw(id: string) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        salesperson: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }

  private async assertCanView(actor: CurrentUserPayload, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
      select: { id: true, salespersonId: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    const visible = await getVisibleSalespersonIds(this.prisma, actor);
    if (!visible.includes(customer.salespersonId)) {
      throw new ForbiddenException('Sem acesso a este cliente');
    }
    return customer;
  }

  private async assertCanEdit(actor: CurrentUserPayload, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    // Vendedor edita só seus próprios; supervisor e manager edita os do escopo
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

  private async resolveSalespersonId(
    actor: CurrentUserPayload,
    requested?: string,
  ): Promise<string> {
    if (actor.role === UserRole.SALESPERSON) {
      // Vendedor sempre cria pra si mesmo
      if (requested && requested !== actor.sub) {
        throw new ForbiddenException('Vendedor só pode criar clientes para si mesmo');
      }
      return actor.sub;
    }

    if (!requested) {
      // Manager/Supervisor não informou — atribui a si mesmo (pode reatribuir depois)
      return actor.sub;
    }

    const can = await canManageUser(this.prisma, actor, requested);
    if (!can) {
      throw new ForbiddenException('Vendedor escolhido fora do seu escopo');
    }

    const u = await this.prisma.user.findFirst({
      where: { id: requested, isActive: true, deletedAt: null },
    });
    if (!u) throw new BadRequestException('Vendedor inválido');

    return requested;
  }
}
