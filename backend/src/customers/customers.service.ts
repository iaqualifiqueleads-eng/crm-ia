import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma, UserRole, ForecastMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ForecastService } from '../forecast/forecast.service';
import { QUEUES, JOBS } from '../workers/workers.types';
import {
  CreateCustomerDto, UpdateCustomerDto, TransferCustomerDto, CustomerFiltersDto,
} from './dto/customers.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getVisibleSalespersonIds, canManageUser } from '../common/scope.util';
import { buildPaginatedResult } from '../common/dto/pagination.dto';

const FIRST_CONTACT_TEMPLATE_ID = '93b6f5db-a0c4-44e7-8552-8cb6ec34b1b5';

/**
 * Normaliza número WhatsApp para comparação de unicidade.
 * Remove tudo que não é dígito e descarta o prefixo "55" (Brasil).
 * Ex: "+55 27 99278-8660", "5527992788660", "27992788660" → "27992788660"
 */
function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
}


@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecast: ForecastService,
    @InjectQueue(QUEUES.REPLENISHMENT) private readonly replenishmentQueue: Queue,
  ) {}

  async create(actor: CurrentUserPayload, dto: CreateCustomerDto) {
    const salespersonId = await this.resolveSalespersonId(actor, dto.salespersonId);

    if (dto.cnpj) {
      const existing = await this.prisma.customer.findUnique({ where: { cnpj: dto.cnpj } });
      if (existing) throw new ConflictException('Já existe cliente com este CNPJ');
    }

    if (dto.whatsapp) {
      await this.assertWhatsappUnique(dto.whatsapp);
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

    await this.forecast.recalculateForCustomer(customer.id);

    // Dispara primeiro contato se o cliente tem whatsapp
    if (customer.whatsapp) {
      const delayMs = (dto.firstContactDelayMinutes ?? 0) * 60 * 1000;
      await this.replenishmentQueue.add(
        JOBS.SEND_REMINDER,
        {
          customerId: customer.id,
          templateId: FIRST_CONTACT_TEMPLATE_ID,
          automationRef: `FIRST_CONTACT_${customer.id}`,
        },
        {
          jobId: `first-contact-${customer.id}`,
          delay: delayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5_000 },
        },
      );
    }

    return this.findOneRaw(customer.id);
  }


  // -------------------------------------------------------
  // EXPORT CSV
  // -------------------------------------------------------
  async exportCsv(actor: CurrentUserPayload, filters: CustomerFiltersDto): Promise<string> {
    const visible = await getVisibleSalespersonIds(this.prisma, actor);

    let salespersonFilter: Prisma.StringFilter | undefined;
    if (filters.salespersonId) {
      if (!visible.includes(filters.salespersonId)) throw new ForbiddenException('Vendedor fora do seu escopo');
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
              { whatsapp: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.customer.findMany({
      where,
      include: { salesperson: { select: { name: true } } },
      orderBy: [{ companyName: 'asc' }],
    });

    const escape = (v: string | null | undefined) => {
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };

    const headers = [
      'Empresa', 'Nome Fantasia', 'CNPJ', 'Contato', 'Cargo', 'E-mail',
      'Telefone', 'WhatsApp', 'Cidade', 'Estado', 'Status', 'Origem',
      'Vendedor', 'Receita Total', 'Pedidos', 'Próxima Reposição', 'Dias Atrasado',
    ].join(',');

    const lines = rows.map((c) => [
      escape(c.companyName),
      escape(c.tradeName),
      escape(c.cnpj),
      escape(c.contactName),
      escape(c.contactRole),
      escape(c.email),
      escape(c.phone),
      escape(c.whatsapp),
      escape(c.city),
      escape(c.state),
      escape(c.status),
      escape(c.origin),
      escape(c.salesperson?.name),
      c.totalRevenue?.toFixed(2) ?? '',
      String(c.totalOrders ?? 0),
      c.nextReplenishmentAt ? c.nextReplenishmentAt.toISOString().split('T')[0] : '',
      String(c.daysOverdue ?? 0),
    ].join(','));

    return [headers, ...lines].join('\r\n');
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
              { whatsapp: { contains: filters.search } },
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

    if (dto.whatsapp && normalizeWhatsapp(dto.whatsapp) !== normalizeWhatsapp(current.whatsapp ?? '')) {
      await this.assertWhatsappUnique(dto.whatsapp, id);
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

  private async assertWhatsappUnique(whatsapp: string, excludeId?: string): Promise<void> {
    const normalized = normalizeWhatsapp(whatsapp);
    const candidates = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        whatsapp: { not: null },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, whatsapp: true, companyName: true },
    });
    const duplicate = candidates.find(
      (c) => normalizeWhatsapp(c.whatsapp!) === normalized,
    );
    if (duplicate) {
      throw new ConflictException(
        `WhatsApp já cadastrado no cliente "${duplicate.companyName}"`,
      );
    }
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
