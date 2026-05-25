import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TaskStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getVisibleSalespersonIds, canManageUser } from '../common/scope.util';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import { CreateTaskDto, UpdateTaskDto, TaskFiltersDto } from './dto/tasks.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // -------------------------------------------------------
  // CREATE
  // -------------------------------------------------------
  async create(actor: CurrentUserPayload, dto: CreateTaskDto) {
    const assigneeId = dto.assigneeId ?? actor.sub;

    // Verifica que o ator pode atribuir tarefa a esse assignee
    if (assigneeId !== actor.sub) {
      const can = await canManageUser(this.prisma, actor, assigneeId);
      if (!can) throw new ForbiddenException('Sem permissão sobre este vendedor');
    }

    // Se vinculou cliente, valida escopo
    if (dto.customerId) {
      await this.assertCustomerAccess(actor, dto.customerId);
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority,
        dueDate: dto.dueDate,
        assigneeId,
        createdById: actor.sub,
        customerId: dto.customerId,
      },
      include: this.defaultInclude(),
    });

    // Notifica o assignee se for diferente do criador
    if (assigneeId !== actor.sub) {
      await this.notifications.create({
        userId: assigneeId,
        title: 'Nova tarefa atribuída',
        message: task.title,
        linkUrl: `/tasks/${task.id}`,
        taskId: task.id,
        customerId: task.customerId ?? undefined,
      });
    }

    return task;
  }

  // -------------------------------------------------------
  // CREATE AUTOMATIC (chamado pelos workers)
  // -------------------------------------------------------
  async createAutomatic(input: {
    title: string;
    description?: string;
    type: any;
    priority: any;
    assigneeId: string;
    customerId?: string;
    dueDate?: Date;
    automationRef: string;
  }) {
    // Evita duplicar — se já existe uma task aberta com o mesmo automationRef
    // e mesmo customerId, não cria outra
    if (input.automationRef && input.customerId) {
      const existing = await this.prisma.task.findFirst({
        where: {
          automationRef: input.automationRef,
          customerId: input.customerId,
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          deletedAt: null,
        },
      });
      if (existing) return existing;
    }

    return this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        type: input.type,
        priority: input.priority,
        assigneeId: input.assigneeId,
        customerId: input.customerId,
        dueDate: input.dueDate,
        isAutomatic: true,
        automationRef: input.automationRef,
      },
    });
  }

  // -------------------------------------------------------
  // LIST
  // -------------------------------------------------------
  async findAll(actor: CurrentUserPayload, filters: TaskFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const visibleUserIds = await getVisibleSalespersonIds(this.prisma, actor);

    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      assigneeId: filters.assigneeId
        ? (visibleUserIds.includes(filters.assigneeId)
            ? filters.assigneeId
            : (() => { throw new ForbiddenException('Vendedor fora do escopo'); })())
        : { in: visibleUserIds },
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.customerId ? { customerId: filters.customerId } : {}),
      ...(filters.search
        ? {
            OR: [
              { title: { contains: filters.search } },
              { description: { contains: filters.search } },
            ],
          }
        : {}),
    };

    if (filters.scope === 'today') {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const end = new Date();   end.setHours(23, 59, 59, 999);
      where.dueDate = { gte: start, lte: end };
      where.status = { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] };
    } else if (filters.scope === 'overdue') {
      where.dueDate = { lt: new Date() };
      where.status = { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] };
    } else if (filters.scope === 'upcoming') {
      where.dueDate = { gt: new Date() };
      where.status = { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: this.defaultInclude(),
        orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  // -------------------------------------------------------
  // GET BY ID
  // -------------------------------------------------------
  async findOne(actor: CurrentUserPayload, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, deletedAt: null },
      include: this.defaultInclude(),
    });
    if (!task) throw new NotFoundException();

    const visible = await getVisibleSalespersonIds(this.prisma, actor);
    if (!visible.includes(task.assigneeId)) {
      throw new ForbiddenException('Sem acesso a esta tarefa');
    }
    return task;
  }

  // -------------------------------------------------------
  // UPDATE
  // -------------------------------------------------------
  async update(actor: CurrentUserPayload, id: string, dto: UpdateTaskDto) {
    const task = await this.findOne(actor, id);

    // Apenas assignee, criador, supervisor ou manager pode editar
    const isOwner = task.assigneeId === actor.sub || task.createdById === actor.sub;
    const isManagerOver = await canManageUser(this.prisma, actor, task.assigneeId);
    if (!isOwner && !isManagerOver) {
      throw new ForbiddenException('Sem permissão');
    }

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      const can = await canManageUser(this.prisma, actor, dto.assigneeId);
      if (!can) throw new ForbiddenException('Sem permissão sobre o novo responsável');
    }

    if (dto.customerId && dto.customerId !== task.customerId) {
      await this.assertCustomerAccess(actor, dto.customerId);
    }

    const completedAt =
      dto.status === TaskStatus.DONE && task.status !== TaskStatus.DONE
        ? new Date()
        : dto.status && dto.status !== TaskStatus.DONE
          ? null
          : task.completedAt;

    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        type: dto.type,
        priority: dto.priority,
        dueDate: dto.dueDate,
        status: dto.status,
        completedAt,
        assigneeId: dto.assigneeId,
        customerId: dto.customerId,
      },
      include: this.defaultInclude(),
    });
  }

  // -------------------------------------------------------
  // COMPLETE
  // -------------------------------------------------------
  async complete(actor: CurrentUserPayload, id: string) {
    return this.update(actor, id, { status: TaskStatus.DONE });
  }

  // -------------------------------------------------------
  // DELETE
  // -------------------------------------------------------
  async remove(actor: CurrentUserPayload, id: string) {
    const task = await this.findOne(actor, id);
    const isOwner = task.createdById === actor.sub;
    const isManager = await canManageUser(this.prisma, actor, task.assigneeId);
    if (!isOwner && !isManager) {
      throw new ForbiddenException('Apenas criador ou supervisor pode excluir');
    }
    await this.prisma.task.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  private defaultInclude() {
    return {
      assignee: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true } },
      customer: { select: { id: true, companyName: true, salespersonId: true } },
    };
  }

  private async assertCustomerAccess(actor: CurrentUserPayload, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!customer) throw new BadRequestException('Cliente inválido');

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
