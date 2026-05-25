import { Injectable, Logger } from '@nestjs/common';
import { ForecastMode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ForecastResult {
  forecastMode: ForecastMode;
  forecastIntervalDays: number | null;
  manualIntervalDays: number | null;
  lastOrderAt: Date | null;
  nextReplenishmentAt: Date | null;
  daysOverdue: number;
  totalOrders: number;
  totalRevenue: Prisma.Decimal;
  averageTicket: Prisma.Decimal;
}

/**
 * Cálculo híbrido (escolha C do briefing):
 *  - Se manualIntervalDays está definido E forecastMode = MANUAL -> usa o manual
 *  - Senão, calcula a média dos intervalos entre pedidos consecutivos
 *  - Se houver < 2 pedidos, não há previsão ainda (nextReplenishmentAt = null)
 *  - daysOverdue = max(0, hoje - nextReplenishmentAt) em dias completos
 */
@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula a previsão de UM cliente e persiste no registro.
   * Chamado:
   *   - após criar/atualizar/excluir um pedido
   *   - quando vendedor sobrescreve o intervalo manual
   *   - por job diário (atualiza daysOverdue mesmo sem novos pedidos)
   */
  async recalculateForCustomer(customerId: string): Promise<ForecastResult> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        forecastMode: true,
        manualIntervalDays: true,
      },
    });

    if (!customer) {
      throw new Error(`Customer ${customerId} não encontrado`);
    }

    // Busca todos os pedidos não-deletados ordenados cronologicamente
    const orders = await this.prisma.order.findMany({
      where: { customerId, deletedAt: null },
      orderBy: { orderedAt: 'asc' },
      select: { orderedAt: true, totalAmount: true },
    });

    const totalOrders = orders.length;
    const totalRevenue = orders.reduce(
      (acc, o) => acc.plus(o.totalAmount),
      new Prisma.Decimal(0),
    );
    const averageTicket = totalOrders > 0
      ? totalRevenue.dividedBy(totalOrders)
      : new Prisma.Decimal(0);

    const lastOrderAt = orders.length > 0 ? orders[orders.length - 1].orderedAt : null;

    // Calcula intervalo médio (em dias)
    let computedAverageDays: number | null = null;
    if (orders.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < orders.length; i++) {
        const diffMs =
          orders[i].orderedAt.getTime() - orders[i - 1].orderedAt.getTime();
        intervals.push(diffMs / (1000 * 60 * 60 * 24));
      }
      computedAverageDays = Math.round(
        intervals.reduce((a, b) => a + b, 0) / intervals.length,
      );
    }

    // Resolução do intervalo efetivo
    const effectiveInterval =
      customer.forecastMode === ForecastMode.MANUAL && customer.manualIntervalDays
        ? customer.manualIntervalDays
        : computedAverageDays;

    let nextReplenishmentAt: Date | null = null;
    if (lastOrderAt && effectiveInterval && effectiveInterval > 0) {
      nextReplenishmentAt = new Date(lastOrderAt);
      nextReplenishmentAt.setDate(nextReplenishmentAt.getDate() + effectiveInterval);
    }

    const daysOverdue = nextReplenishmentAt
      ? this.diffInDays(new Date(), nextReplenishmentAt)
      : 0;

    const result: ForecastResult = {
      forecastMode: customer.forecastMode,
      forecastIntervalDays: computedAverageDays,
      manualIntervalDays: customer.manualIntervalDays,
      lastOrderAt,
      nextReplenishmentAt,
      daysOverdue: Math.max(0, daysOverdue),
      totalOrders,
      totalRevenue,
      averageTicket,
    };

    await this.prisma.customer.update({
      where: { id: customerId },
      data: {
        forecastIntervalDays: result.forecastIntervalDays,
        lastOrderAt: result.lastOrderAt,
        nextReplenishmentAt: result.nextReplenishmentAt,
        daysOverdue: result.daysOverdue,
        totalOrders: result.totalOrders,
        totalRevenue: result.totalRevenue,
        averageTicket: result.averageTicket,
      },
    });

    return result;
  }

  /**
   * Atualiza apenas o daysOverdue de todos os clientes ativos.
   * Será usado pelo worker diário na Fase 1.2.
   */
  async refreshAllOverdues(): Promise<{ updated: number }> {
    const candidates = await this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        nextReplenishmentAt: { not: null },
      },
      select: { id: true, nextReplenishmentAt: true, daysOverdue: true },
    });

    let updated = 0;
    for (const c of candidates) {
      const newOverdue = Math.max(0, this.diffInDays(new Date(), c.nextReplenishmentAt!));
      if (newOverdue !== c.daysOverdue) {
        await this.prisma.customer.update({
          where: { id: c.id },
          data: { daysOverdue: newOverdue },
        });
        updated++;
      }
    }

    this.logger.log(`Overdues atualizados: ${updated}/${candidates.length}`);
    return { updated };
  }

  private diffInDays(later: Date, earlier: Date): number {
    const ms = later.getTime() - earlier.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }
}
