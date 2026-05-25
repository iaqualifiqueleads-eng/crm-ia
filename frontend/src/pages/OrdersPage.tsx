import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, LoadingRow } from '@/components/ui/EmptyState';
import { useOrders } from '@/features/orders/useOrders';
import { OrderFormModal } from '@/features/orders/OrderFormModal';
import { formatCurrency, formatDate } from '@/lib/utils';

const channelLabel: Record<string, string> = {
  WHATSAPP: 'WhatsApp', PHONE: 'Telefone', EMAIL: 'E-mail',
  IN_PERSON: 'Presencial', ECOMMERCE: 'E-commerce', OTHER: 'Outro',
};

export function OrdersPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isFetching } = useOrders({
    page, limit: 25,
    search: search || undefined,
    channel: channel || undefined,
  });

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Pedidos"
        description="Cada pedido registrado recalcula automaticamente a previsão de recompra do cliente."
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Registrar pedido
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-smoke" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por número ou cliente..."
            className="pl-10"
          />
        </div>
        <Select
          value={channel}
          onChange={(e) => { setChannel(e.target.value); setPage(1); }}
          className="w-auto min-w-[180px]"
        >
          <option value="">Todos os canais</option>
          {Object.entries(channelLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-platinum-50/50 border-b border-platinum-100/80">
                {['Data', 'Pedido', 'Cliente', 'Canal', 'Itens', 'Valor'].map((h, i) => (
                  <th
                    key={h}
                    className={`text-2xs uppercase tracking-micro text-smoke px-5 py-3 font-medium ${i === 5 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-platinum-100/60">
              {isLoading && <><LoadingRow cols={6} /><LoadingRow cols={6} /><LoadingRow cols={6} /></>}

              {!isLoading && (data?.data.length ?? 0) === 0 && (
                <tr><td colSpan={6}>
                  <EmptyState
                    title="Nenhum pedido registrado"
                    description="Comece registrando o primeiro pedido para alimentar a previsão de recompra."
                    icon={<Package className="h-10 w-10" />}
                    action={<Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>Registrar pedido</Button>}
                  />
                </td></tr>
              )}

              {!isLoading && data?.data.map((o, i) => (
                <motion.tr
                  key={o.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3, delay: i * 0.02 }}
                  className="hover:bg-platinum-50/40 transition-colors"
                >
                  <td className="px-5 py-3.5 font-mono text-graphite tabular-nums">
                    {formatDate(o.orderedAt)}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-onyx">
                    {o.orderNumber ?? <span className="text-smoke">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => o.customer && navigate(`/customers/${o.customer.id}`)}
                      className="text-onyx hover:text-champagne transition-colors truncate text-left"
                    >
                      {o.customer?.companyName ?? '—'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <Chip tone="neutral">{channelLabel[o.channel] ?? o.channel}</Chip>
                  </td>
                  <td className="px-5 py-3.5 text-graphite">
                    {o.items?.length ?? 0} {o.items?.length === 1 ? 'item' : 'itens'}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-onyx tabular-nums text-right">
                    {formatCurrency(o.totalAmount)}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-platinum-100/70 bg-platinum-50/30">
            <div className="text-xs text-smoke">
              Página <span className="text-onyx tabular-nums">{data.meta.page}</span> de{' '}
              <span className="text-onyx tabular-nums">{data.meta.totalPages}</span>
              {' · '}{data.meta.total} pedidos
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => Math.max(1, p - 1))} icon={<ChevronLeft className="h-4 w-4" />}>Anterior</Button>
              <Button variant="ghost" size="sm" disabled={page >= data.meta.totalPages || isFetching} onClick={() => setPage((p) => p + 1)}>Próxima <ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        )}
      </Card>

      <OrderFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
