import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { CreateTemplateDto, UpdateTemplateDto, TemplateFiltersDto } from './dto/templates.dto';
import { buildPaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: CurrentUserPayload, dto: CreateTemplateDto) {
    this.assertCanManage(actor);
    return this.prisma.messageTemplate.create({
      data: {
        name: dto.name,
        trigger: dto.trigger,
        body: dto.body,
        aiInstructions: dto.aiInstructions,
        channel: dto.channel ?? 'whatsapp',
        isActive: dto.isActive ?? true,
        createdById: actor.sub,
      },
    });
  }

  async findAll(actor: CurrentUserPayload, filters: TemplateFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where: Prisma.MessageTemplateWhereInput = {
      deletedAt: null,
      ...(filters.trigger ? { trigger: filters.trigger } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.search
        ? {
            OR: [
              { name: { contains: filters.search } },
              { body: { contains: filters.search } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.messageTemplate.findMany({
        where,
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: [{ trigger: 'asc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.messageTemplate.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  async findOne(_actor: CurrentUserPayload, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    if (!template) throw new NotFoundException();
    return template;
  }

  async update(actor: CurrentUserPayload, id: string, dto: UpdateTemplateDto) {
    this.assertCanManage(actor);
    const t = await this.prisma.messageTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!t) throw new NotFoundException();

    return this.prisma.messageTemplate.update({
      where: { id },
      data: {
        name: dto.name,
        trigger: dto.trigger,
        body: dto.body,
        aiInstructions: dto.aiInstructions,
        channel: dto.channel,
        isActive: dto.isActive,
      },
    });
  }

  async remove(actor: CurrentUserPayload, id: string) {
    this.assertCanManage(actor);
    const t = await this.prisma.messageTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!t) throw new NotFoundException();
    await this.prisma.messageTemplate.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { success: true };
  }

  private assertCanManage(actor: CurrentUserPayload) {
    if (actor.role === UserRole.SALESPERSON) {
      throw new ForbiddenException('Vendedores não gerenciam templates');
    }
  }
}
