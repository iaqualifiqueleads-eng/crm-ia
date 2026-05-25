import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Chip, CustomerStatusChip } from '@/components/ui/Chip';
import { EmptyState, LoadingRow } from '@/components/ui/EmptyState';
import { useCustomers } from '@/features/customers/useCustomers';
import { CustomerFormModal } from '@/features/customers/CustomerFormModal';
import { formatCurrency, formatDate, getInitials, cn } from '@/lib/utils';
import type { CustomerStatus } from '@/types';

export function CustomersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<CustomerStatus | ''>('');
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isFetching } = useCustomers({
    page, limit: 20, search: search || undefined,
    status: status || undefined, onlyOverdue: onlyOverdue || undefined,
  });

  return (
    <>
      <PageHeader
        eyebrow="Carteira"
        title="Clientes"
        description="A lista respeita o seu escopo hierárquico. Gerentes e supervisores visualizam toda a equipe; vendedores veem apenas a própria carteira."
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Novo cliente
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-smoke" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nome, CNPJ ou contato..."
            className="pl-10"
          />
        </div>
        <Select
          value={status}
          onChange={(e) => { setStatus(e.target.value as CustomerStatus | ''); setPage(1); }}
          className="w-auto min-w-[160px]"
        >
          <option value="">Todos os status</option>
          <option value="LEAD">Lead</option>
          <option value="PROSPECT">Prospect</option>
          <option value="ACTIVE">Ativo</option>
          <option value="AT_RISK">Em Risco</option>
          <option value="CHURNED">Perdido</option>
        </Select>
        <button
          type="button"
          onClick={() => { setOnlyOverdue((v) => !v); setPage(1); }}
          className={cn(
            'h-11 px-4 rounded-sharp border text-sm flex items-center gap-2 transition-colors',
            onlyOverdue
              ? 'bg-onyx text-pearl border-onyx'
              : 'bg-pearl text-onyx border-platinum-100 hover:border-onyx',
          )}
        >
          <Filter className="h-4 w-4" />
          Somente atrasados
        </button>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-platinum-50/50 border-b border-platinum-100/80">
                {['Cliente', 'Responsável', 'Status', 'Previsão', 'Receita', 'Pedidos'].map((h) => (
                  <th key={h} className="text-left text-2xs uppercase tracking-micro text-smoke px-5 py-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum-100/60">
              {isLoading && (
                <>
                  <LoadingRow cols={6} />
                  <LoadingRow cols={6} />
                  <LoadingRow cols={6} />
                </>
              )}

              {!isLoading && (data?.data.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title="Nenhum cliente encontrado"
                      description="Ajuste os filtros ou cadastre um novo cliente para começar."
                      action={
                        <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                          Novo cliente
                        </Button>
                      }
                    />
                  </td>
                </tr>
              )}

              {!isLoading && data?.data.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  onClick={() => navigate(`/customers/${c.id}`)}
                  className="cursor-pointer hover:bg-platinum-50/40 transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="h-9 w-9 rounded-sharp bg-onyx text-pearl text-xs font-mono inline-flex items-center justify-center shrink-0">
                        {getInitials(c.companyName)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-onyx truncate">{c.companyName}</div>
                        <div className="text-2xs text-smoke truncate">
                          {[c.contactName, c.city].filter(Boolean).join(' · ') || c.cnpj || '—'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-graphite">
                    {c.salesperson?.name ?? '—'}
                  </td>
                  <td className="px-5 py-4">
                    <CustomerStatusChip status={c.status} />
                  </td>
                  <td className="px-5 py-4">
                    {c.daysOverdue > 0 ? (
                      <Chip tone="signal">+{c.daysOverdue}d atrasado</Chip>
                    ) : c.nextReplenishmentAt ? (
                      <span className="text-sm text-graphite tabular-nums font-mono">
                        {formatDate(c.nextReplenishmentAt)}
                      </span>
                    ) : (
                      <span className="text-2xs text-smoke">sem previsão</span>
                    )}
                  </td>
                  <td className="px-5 py-4 font-mono text-onyx tabular-nums">
                    {formatCurrency(c.totalRevenue)}
                  </td>
                  <td className="px-5 py-4 font-mono text-onyx tabular-nums text-right">
                    {c.totalOrders}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-platinum-100/70 bg-platinum-50/30">
            <div className="text-xs text-smoke">
              Página <span className="text-onyx tabular-nums">{data.meta.page}</span> de{' '}
              <span className="text-onyx tabular-nums">{data.meta.totalPages}</span>
              {' · '}{data.meta.total} clientes
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                icon={<ChevronLeft className="h-4 w-4" />}
              >
                Anterior
              </Button>
              <Button
                variant="ghost" size="sm"
                disabled={page >= data.meta.totalPages || isFetching}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <CustomerFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
