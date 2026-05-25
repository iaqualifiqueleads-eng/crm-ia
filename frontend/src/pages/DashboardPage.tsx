import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, Clock, AlertTriangle, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, CardEyebrow } from '@/components/ui/Card';
import { MetricCard } from '@/components/charts/MetricCard';
import { NewCustomersChart } from '@/components/charts/NewCustomersChart';
import { StatusDistribution } from '@/components/charts/StatusDistribution';
import { Skeleton } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { CustomerStatusChip } from '@/components/ui/Chip';
import { Button } from '@/components/ui/Button';
import { useDashboardSummary, useDrillDown } from '@/features/dashboard/useDashboard';
import { useAuthStore } from '@/store/auth.store';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [days] = useState(30);
  const [drillMetric, setDrillMetric] = useState<string | null>(null);
  const navigate = useNavigate();

  const { data, isLoading } = useDashboardSummary(days);
  const { data: drillData, isLoading: drillLoading } = useDrillDown(drillMetric);

  return (
    <>
      <PageHeader
        eyebrow={`Olá, ${user?.name?.split(' ')[0] ?? ''}`}
        title="Visão Geral da Carteira"
        description={`Acompanhamento dos últimos ${days} dias · números calculados em tempo real conforme o seu escopo.`}
      />

      {/* ============== MÉTRICAS PRINCIPAIS ============== */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <MetricCard
          eyebrow="Carteira ativa"
          value={isLoading ? '—' : formatNumber(data?.totals.customers ?? 0)}
          caption={`${data?.totals.newCustomersInPeriod ?? 0} novos no período`}
          delay={0.05}
        />
        <MetricCard
          eyebrow="A repor em ≤ 7 dias"
          value={isLoading ? '—' : formatNumber(data?.totals.dueSoonCustomers ?? 0)}
          caption="Clientes com próxima compra prevista para esta semana"
          accent="champagne"
          onClick={() => setDrillMetric('dueSoon')}
          delay={0.1}
        />
        <MetricCard
          eyebrow="Em atraso"
          value={isLoading ? '—' : formatNumber(data?.totals.overdueCustomers ?? 0)}
          caption="Já cruzaram a data prevista de recompra"
          accent="signal"
          onClick={() => setDrillMetric('overdue')}
          delay={0.15}
        />
        <MetricCard
          eyebrow={`Receita · ${days}d`}
          value={isLoading ? '—' : formatCurrency(data?.totals.periodRevenue ?? 0)}
          caption={`${data?.totals.periodOrders ?? 0} pedidos registrados`}
          accent="forest"
          delay={0.2}
        />
      </div>

      {/* ============== SECONDARY ROW ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-10">
        {/* Linha 30d novos clientes */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardEyebrow>Crescimento de carteira</CardEyebrow>
              <CardTitle>Novos clientes · {days} dias</CardTitle>
            </div>
            <div className="flex items-center gap-2 text-2xs uppercase tracking-micro text-smoke">
              <Sparkles className="h-3 w-3 text-champagne" />
              {data?.totals.newCustomersInPeriod ?? 0} no total
            </div>
          </CardHeader>
          <CardContent className="px-2 pt-4 pb-4">
            {isLoading
              ? <Skeleton className="h-64 w-full" />
              : <NewCustomersChart data={data?.newCustomersDaily ?? []} />}
          </CardContent>
        </Card>

        {/* Status distribuição */}
        <Card>
          <CardHeader>
            <div>
              <CardEyebrow>Composição</CardEyebrow>
              <CardTitle>Por status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading
              ? <Skeleton className="h-32 w-full" />
              : <StatusDistribution data={data!.customersByStatus} />}
          </CardContent>
        </Card>
      </div>

      {/* ============== TERTIARY ROW ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        {/* Buckets de atraso */}
        <Card>
          <CardHeader>
            <div>
              <CardEyebrow>Atrasos</CardEyebrow>
              <CardTitle>Por intervalo</CardTitle>
            </div>
            <AlertTriangle className="h-4 w-4 text-signal" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.overdueBuckets?.length ?? 0) === 0 ? (
              <p className="text-xs text-smoke">Sem clientes em atraso. 🎉</p>
            ) : (
              <ul className="space-y-3">
                {data!.overdueBuckets.map((b, i) => (
                  <motion.li
                    key={b.bucket}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-graphite">{b.bucket} dias</span>
                    <span className="font-mono text-onyx tabular-nums">{b.total}</span>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Top vendedores */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardEyebrow>Performance · {days}d</CardEyebrow>
              <CardTitle>Top vendedores por receita</CardTitle>
            </div>
            <TrendingUp className="h-4 w-4 text-champagne" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (data?.topSalespeople?.length ?? 0) === 0 ? (
              <p className="text-xs text-smoke">Sem dados de receita no período.</p>
            ) : (
              <ol className="divide-y divide-platinum-100/70">
                {data!.topSalespeople.map((p, i) => (
                  <motion.li
                    key={p.salespersonId}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="font-display text-2xl text-champagne tabular-nums w-6">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm text-onyx truncate">{p.name}</div>
                        <div className="text-2xs text-smoke">{p.orderCount} pedidos</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-onyx tabular-nums">
                        {formatCurrency(p.totalRevenue)}
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============== TASKS PENDENTES (quick view) ============== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
        <Card>
          <CardHeader>
            <div>
              <CardEyebrow>Sua agenda</CardEyebrow>
              <CardTitle>Tarefas pendentes</CardTitle>
            </div>
            <Clock className="h-4 w-4 text-smoke" />
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="display text-5xl text-onyx">{data?.totals.pendingTasks ?? 0}</div>
              <div className="text-2xs text-smoke uppercase tracking-micro mt-2">total ativas</div>
            </div>
            <Button variant="secondary" onClick={() => navigate('/tasks')}>Abrir agenda</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardEyebrow>Atenção imediata</CardEyebrow>
              <CardTitle className="text-signal">Tarefas vencidas</CardTitle>
            </div>
            <AlertTriangle className="h-4 w-4 text-signal" />
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div>
              <div className="display text-5xl text-signal">{data?.totals.overdueTasks ?? 0}</div>
              <div className="text-2xs text-smoke uppercase tracking-micro mt-2">prazo ultrapassado</div>
            </div>
            <Button variant="secondary" onClick={() => navigate('/tasks?scope=overdue')}>Ver lista</Button>
          </CardContent>
        </Card>
      </div>

      {/* ============== DRILL DOWN MODAL ============== */}
      <Modal
        open={!!drillMetric}
        onClose={() => setDrillMetric(null)}
        eyebrow="Drill-down"
        title={drillMetric === 'overdue' ? 'Clientes em atraso' :
               drillMetric === 'dueSoon' ? 'A repor nos próximos 7 dias' :
               'Detalhamento'}
        size="lg"
      >
        {drillLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : (drillData?.customers.length ?? 0) === 0 ? (
          <p className="text-sm text-smoke text-center py-8">Nada por aqui no momento.</p>
        ) : (
          <ul className="divide-y divide-platinum-100/70">
            {drillData!.customers.slice(0, 50).map((c) => (
              <li key={c.id} className="py-3 flex items-center justify-between gap-4">
                <button
                  onClick={() => { setDrillMetric(null); navigate(`/customers/${c.id}`); }}
                  className="text-left flex-1 min-w-0 group"
                >
                  <div className="text-sm text-onyx truncate group-hover:text-champagne transition-colors">
                    {c.companyName}
                  </div>
                  <div className="text-2xs text-smoke mt-0.5">
                    {c.contactName ? `${c.contactName} · ` : ''}
                    {c.salesperson?.name ?? '—'}
                  </div>
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <CustomerStatusChip status={c.status} />
                  {c.daysOverdue > 0 && (
                    <span className="text-2xs font-mono text-signal">+{c.daysOverdue}d</span>
                  )}
                  {c.nextReplenishmentAt && c.daysOverdue === 0 && (
                    <span className="text-2xs font-mono text-smoke">{formatDate(c.nextReplenishmentAt)}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
