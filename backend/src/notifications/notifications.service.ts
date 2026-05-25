import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { NotificationSeverity, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { PaginationDto, buildPaginatedResult } from '../common/dto/pagination.dto';

export interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  severity?: NotificationSeverity;
  linkUrl?: string;
  customerId?: string;
  taskId?: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(inputs: CreateNotificationInput[]) {
    if (inputs.length === 0) return { count: 0 };
    return this.prisma.notification.createMany({
      data: inputs.map((i) => ({
        userId: i.userId,
        title: i.title,
        message: i.message,
        severity: i.severity ?? NotificationSeverity.INFO,
        linkUrl: i.linkUrl,
        customerId: i.customerId,
        taskId: i.taskId,
      })),
    });
  }

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        severity: input.severity ?? NotificationSeverity.INFO,
        linkUrl: input.linkUrl,
        customerId: input.customerId,
        taskId: input.taskId,
      },
    });
  }

  async listForUser(actor: CurrentUserPayload, pagination: PaginationDto, unreadOnly?: boolean) {
    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 20;

    const where: Prisma.NotificationWhereInput = {
      userId: actor.sub,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [data, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId: actor.sub, readAt: null } }),
    ]);

    const result = buildPaginatedResult(data, total, page, limit);
    return { ...result, unreadCount: unread };
  }

  async markAsRead(actor: CurrentUserPayload, id: string) {
    const n = await this.prisma.notification.findUnique({ where: { id } });
    if (!n) throw new NotFoundException();
    if (n.userId !== actor.sub) throw new ForbiddenException();
    if (n.readAt) return n;
    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(actor: CurrentUserPayload) {
    return this.prisma.notification.updateMany({
      where: { userId: actor.sub, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async unreadCount(actor: CurrentUserPayload) {
    const count = await this.prisma.notification.count({
      where: { userId: actor.sub, readAt: null },
    });
    return { unreadCount: count };
  }
}
