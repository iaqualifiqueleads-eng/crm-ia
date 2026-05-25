import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Conectado ao MySQL via Prisma');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Helper para soft delete consistente em customers/orders.
   * Não é usado automaticamente nas queries — cada módulo aplica
   * o filtro `where: { deletedAt: null }` explicitamente.
   */
  async softDelete(model: 'customer' | 'order' | 'user', id: string) {
    return (this as any)[model].update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
