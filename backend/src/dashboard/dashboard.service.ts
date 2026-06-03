import { Injectable, ForbiddenException } from '@nestjs/common';
import {
  CustomerStatus,
  TaskStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getVisibleSalespersonIds } from '../common/scope.util';
import { DashboardFiltersDto, DrillDownFiltersDto } from './dto/dashboard.dto';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resumo principal do dashboard.
   * Tudo respeitando o escopo de visibilidade (vendedor só vê seus números).
   */
  async getSummary(actor: CurrentUserPayload, filters: DashboardFiltersDto) {
    const days = filters.days ?? 30;
    const visible = await this.resolveScope(actor, filters.salespersonId);
    const customerWhere = this.customerScope(visible);

    const since = new Date();
    since.setDate(since.getDate() - days);

    const [
      totalCustomers,
      byStatus,
      overdueCount,
      dueSoonCount,
      newCustomersInPeriod,
      pendingTasks,
      overdueTasks,
      revenuePeriod,
      topSalespeople,
      overdueByBucket,
      newCustomersDaily,
    ] = await Promise.all([
      // Total
      this.prisma.customer.count({ where: customerWhere }),

      // Por status
      this.prisma.customer.groupBy({
        by: ['status'],
        where: customerWhere,
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),

      // Atrasados
      this.prisma.customer.count({
        where: { ...customerWhere, daysOverdue: { gt: 0 } },
      }),

      // Para repor nos próximos 7 dias
      this.prisma.customer.count({
        where: {
          ...customerWhere,
          daysOverdue: 0,
          nextReplenishmentAt: {
            gte: new Date(),
            lte: this.daysFromNow(7),
          },
        },
      }),

      // Novos clientes no período
      this.prisma.customer.count({
        where: { ...customerWhere, createdAt: { gte: since } },
      }),

      // Tarefas pendentes (escopo do usuário)
      this.prisma.task.count({
        where: {
          deletedAt: null,
          assigneeId: { in: visible },
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        },
      }),

      // Tarefas vencidas
      this.prisma.task.count({
        where: {
          deletedAt: null,
          assigneeId: { in: visible },
          status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
          dueDate: { lt: new Date() },
        },
      }),

      // Receita do período
      this.prisma.order.aggregate({
        where: {
          deletedAt: null,
          orderedAt: { gte: since },
          customer: { ...customerWhere },
        },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),

      // Top 5 vendedores por receita
      (this.prisma.$queryRaw as any)(Prisma.sql`
        SELECT
          u.id           AS salespersonId,
          u.name         AS name,
          COALESCE(SUM(o.\`totalAmount\`), 0) AS totalRevenue,
          COUNT(o.id)    AS orderCount
        FROM users u
        LEFT JOIN customers c
          ON c.\`salespersonId\` = u.id AND c.\`deletedAt\` IS NULL
        LEFT JOIN orders o
          ON o.\`customerId\` = c.id AND o.\`deletedAt\` IS NULL AND o.\`orderedAt\` >= ${since}
        WHERE u.id IN (${Prisma.join(visible.length ? visible : [''])})
          AND u.\`deletedAt\` IS NULL
        GROUP BY u.id, u.name
        ORDER BY totalRevenue DESC
        LIMIT 5
      `) as Promise<Array<{ salespersonId: string; name: string; totalRevenue: number; orderCount: number }>>,

      // Buckets de atraso
      (this.prisma.$queryRaw as any)(Prisma.sql`
        SELECT
          CASE
            WHEN \`daysOverdue\` BETWEEN 1 AND 3   THEN '1-3'
            WHEN \`daysOverdue\` BETWEEN 4 AND 7   THEN '4-7'
            WHEN \`daysOverdue\` BETWEEN 8 AND 15  THEN '8-15'
            WHEN \`daysOverdue\` BETWEEN 16 AND 30 THEN '16-30'
            WHEN \`daysOverdue\` > 30              THEN '30+'
            ELSE '0'
          END AS bucket,
          COUNT(*) AS total
        FROM customers
        WHERE \`deletedAt\` IS NULL
          AND \`salespersonId\` IN (${Prisma.join(visible.length ? visible : [''])})
          AND \`daysOverdue\` > 0
        GROUP BY bucket
      `) as Promise<Array<{ bucket: string; total: bigint }>>,

      // Série diária de novos clientes
      (this.prisma.$queryRaw as any)(Prisma.sql`
        SELECT
          DATE(\`createdAt\`) AS day,
          COUNT(*) AS total
        FROM customers
        WHERE \`deletedAt\` IS NULL
          AND \`createdAt\` >= ${since}
          AND \`salespersonId\` IN (${Prisma.join(visible.length ? visible : [''])})
        GROUP BY DATE(\`createdAt\`)
        ORDER BY day ASC
      `) as Promise<Array<{ day: Date; total: bigint }>>,
    ]);

    return {
      totals: {
        customers: totalCustomers,
        overdueCustomers: overdueCount,
        dueSoonCustomers: dueSoonCount,
        newCustomersInPeriod,
        pendingTasks,
        overdueTasks,
        periodRevenue: revenuePeriod._sum.totalAmount ?? 0,
        periodOrders: revenuePeriod._count._all,
      },
      customersByStatus: this.normalizeStatusCounts(byStatus),
      overdueBuckets: overdueByBucket.map((b) => ({
        bucket: b.bucket,
        total: Number(b.total),
      })),
      newCustomersDaily: newCustomersDaily.map((row) => ({
        day: row.day,
        total: Number(row.total),
      })),
      topSalespeople: topSalespeople.map((s) => ({
        salespersonId: s.salespersonId,
        name: s.name,
        totalRevenue: Number(s.totalRevenue),
        orderCount: Number(s.orderCount),
      })),
      meta: {
        scopedToUserIds: visible.length,
        periodDays: days,
      },
    };
  }

  /**
   * Drill-down: clicar num número do dashboard mostra os clientes que o compõem.
   */
  async drillDown(actor: CurrentUserPayload, filters: DrillDownFiltersDto) {
    const visible = await this.resolveScope(actor, filters.salespersonId);
    const baseWhere = this.customerScope(visible);
    const metric = filters.metric ?? 'overdue';

    let where: Prisma.CustomerWhereInput = baseWhere;

    switch (metric) {
      case 'overdue':
        where = { ...baseWhere, daysOverdue: { gt: 0 } };
        break;
      case 'dueSoon':
        where = {
          ...baseWhere,
          daysOverdue: 0,
          nextReplenishmentAt: { gte: new Date(), lte: this.daysFromNow(7) },
        };
        break;
      case 'active':
        where = { ...baseWhere, status: CustomerStatus.ACTIVE };
        break;
      case 'atRisk':
        where = { ...baseWhere, status: CustomerStatus.AT_RISK };
        break;
      case 'churned':
        where = { ...baseWhere, status: CustomerStatus.CHURNED };
        break;
      case 'newThisMonth': {
        const since = new Date();
        since.setDate(since.getDate() - (filters.days ?? 30));
        where = { ...baseWhere, createdAt: { gte: since } };
        break;
      }
      default:
        throw new ForbiddenException(`Métrica desconhecida: ${metric}`);
    }

    const customers = await this.prisma.customer.findMany({
      where,
      include: { salesperson: { select: { id: true, name: true } } },
      orderBy: [{ daysOverdue: 'desc' }, { companyName: 'asc' }],
      take: 200,
    });

    return { metric, total: customers.length, customers };
  }

  // -------------------------------------------------------
  // Helpers
  // -------------------------------------------------------
  private async resolveScope(actor: CurrentUserPayload, requested?: string): Promise<string[]> {
    const visible = await getVisibleSalespersonIds(this.prisma, actor);
    if (requested) {
      if (!visible.includes(requested)) {
        throw new ForbiddenException('Vendedor fora do seu escopo');
      }
      return [requested];
    }
    return visible;
  }

  private customerScope(visible: string[]): Prisma.CustomerWhereInput {
    return {
      deletedAt: null,
      salespersonId: { in: visible },
    };
  }

  private daysFromNow(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
  }

  private normalizeStatusCounts(byStatus: Array<{ status: CustomerStatus; _count: { _all: number } }>) {
    const empty: Record<CustomerStatus, number> = {
      [CustomerStatus.LEAD]: 0,
      [CustomerStatus.PROSPECT]: 0,
      [CustomerStatus.ACTIVE]: 0,
      [CustomerStatus.AT_RISK]: 0,
      [CustomerStatus.CHURNED]: 0,
    };
    for (const row of byStatus) {
      empty[row.status] = row._count._all;
    }
    return empty;
  }
}
