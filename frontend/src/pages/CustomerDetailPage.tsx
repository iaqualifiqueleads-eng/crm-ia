import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft, Edit3, Phone, Mail, MessageCircle, MapPin, Building2,
  CalendarClock, TrendingUp, Activity, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardEyebrow, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CustomerStatusChip, Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/EmptyState';
import { CustomerFormModal } from '@/features/customers/CustomerFormModal';
import { useCustomer, useCustomerTimeline } from '@/features/customers/useCustomers';
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber, getInitials } from '@/lib/utils';

const eventIconMap: Record<string, React.ElementType> = {
  CREATED:          Building2,
  STATUS_CHANGED:   Activity,
  TRANSFERRED:      TrendingUp,
  FORECAST_UPDATED: CalendarClock,
  ORDER_CREATED:    TrendingUp,
  NOTE:             MessageCircle,
};

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

  const { data: customer, isLoading } = useCustomer(id);
  const { data: timeline } = useCustomerTimeline(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-96" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  if (!customer) {
    return (
      <Card className="p-12 text-center">
        <p className="text-smoke">Cliente não encontrado.</p>
        <Button variant="secondary" onClick={() => navigate('/customers')} className="mt-4">
          Voltar para a carteira
        </Button>
      </Card>
    );
  }

  const isOverdue = customer.daysOverdue > 0;

  return (
    <>
      {/* Breadcrumb */}
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 text-2xs uppercase tracking-micro text-smoke hover:text-onyx mb-6 transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Voltar para Carteira
      </Link>

      <PageHeader
        eyebrow={customer.cnpj ?? 'Cliente'}
        title={customer.companyName}
        description={[customer.tradeName, customer.contactName, customer.city]
          .filter(Boolean).join(' · ')}
        actions={
          <>
            <CustomerStatusChip status={customer.status} />
            <Button variant="secondary" onClick={() => setEditOpen(true)} icon={<Edit3 className="h-4 w-4" />}>
              Editar
            </Button>
          </>
        }
      />

      {/* Alerta de atraso editorial */}
      {isOverdue && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-3 px-5 py-3 bg-signal/8 border border-signal/25 rounded-sharp"
        >
          <AlertTriangle className="h-4 w-4 text-signal shrink-0" />
          <div className="flex-1 text-sm">
            <span className="text-onyx">
              <strong className="font-medium">{customer.daysOverdue} dias</strong> atrasado na reposição
            </span>
            {customer.nextReplenishmentAt && (
              <span className="text-smoke ml-2 text-xs">
                · previsto para {formatDate(customer.nextReplenishmentAt)}
              </span>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Coluna esquerda */}
        <div className="lg:col-span-2 space-y-5">
          {/* Métricas do cliente */}
          <Card>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 py-7">
              <Metric eyebrow="Pedidos" value={formatNumber(customer.totalOrders)} />
              <Metric eyebrow="Receita total" value={formatCurrency(customer.totalRevenue)} />
              <Metric eyebrow="Ticket médio" value={formatCurrency(customer.averageTicket)} />
              <Metric
                eyebrow="Última compra"
                value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'}
                mono
              />
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Atividade</CardEyebrow>
                <CardTitle>Linha do tempo</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {!timeline || timeline.length === 0 ? (
                <p className="text-sm text-smoke">Sem eventos registrados ainda.</p>
              ) : (
                <ol className="relative pl-7 space-y-5">
                  <span className="absolute left-2 top-1 bottom-1 w-px bg-platinum-100/70" />
                  {timeline.map((ev, i) => {
                    const Icon = eventIconMap[ev.type] ?? Activity;
                    return (
                      <motion.li
                        key={ev.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="relative"
                      >
                        <span className="absolute -left-7 top-0 h-5 w-5 rounded-sharp bg-pearl border border-platinum-100 inline-flex items-center justify-center">
                          <Icon className="h-2.5 w-2.5 text-graphite" />
                        </span>
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="text-sm text-onyx">{ev.title}</span>
                          <time className="text-2xs text-smoke font-mono shrink-0">
                            {formatDateTime(ev.createdAt)}
                          </time>
                        </div>
                        {ev.description && (
                          <p className="text-xs text-smoke mt-1">{ev.description}</p>
                        )}
                        {ev.author && (
                          <p className="text-2xs text-smoke/70 mt-1">por {ev.author.name}</p>
                        )}
                      </motion.li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Notas */}
          {customer.notes && (
            <Card>
              <CardHeader>
                <div>
                  <CardEyebrow>Contexto</CardEyebrow>
                  <CardTitle>Anotações</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-graphite whitespace-pre-wrap">{customer.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Coluna direita */}
        <div className="space-y-5">
          {/* Card do responsável */}
          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Responsável</CardEyebrow>
                <CardTitle className="text-base">Vendedor da carteira</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {customer.salesperson ? (
                <div className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-sharp bg-onyx text-pearl text-sm font-mono inline-flex items-center justify-center">
                    {getInitials(customer.salesperson.name)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-onyx truncate">{customer.salesperson.name}</div>
                    <div className="text-2xs text-smoke truncate">{customer.salesperson.email}</div>
                  </div>
                </div>
              ) : <p className="text-sm text-smoke">Sem responsável atribuído.</p>}
            </CardContent>
          </Card>

          {/* Contato */}
          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Contato</CardEyebrow>
                <CardTitle className="text-base">Como falar com este cliente</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ContactLine icon={Building2} label="CNPJ" value={customer.cnpj} mono />
              <ContactLine icon={Mail} label="E-mail" value={customer.email} />
              <ContactLine icon={Phone} label="Telefone" value={customer.phone} />
              <ContactLine icon={MessageCircle} label="WhatsApp" value={customer.whatsapp} mono />
              <ContactLine
                icon={MapPin}
                label="Localização"
                value={[customer.city, customer.state].filter(Boolean).join(' / ') || null}
              />
            </CardContent>
          </Card>

          {/* Previsão */}
          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Cadência</CardEyebrow>
                <CardTitle className="text-base">Previsão de recompra</CardTitle>
              </div>
              <Chip tone={customer.forecastMode === 'MANUAL' ? 'champagne' : 'neutral'}>
                {customer.forecastMode === 'MANUAL' ? 'Manual' : 'Automática'}
              </Chip>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Intervalo médio">
                {customer.forecastIntervalDays ? `${customer.forecastIntervalDays} dias` : '—'}
              </Row>
              {customer.manualIntervalDays && (
                <Row label="Intervalo manual">
                  <span className="text-champagne">{customer.manualIntervalDays} dias</span>
                </Row>
              )}
              <Row label="Próxima reposição">
                {customer.nextReplenishmentAt
                  ? <span className={cn('font-mono', isOverdue && 'text-signal')}>
                      {formatDate(customer.nextReplenishmentAt)}
                    </span>
                  : 'sem previsão'}
              </Row>
            </CardContent>
          </Card>
        </div>
      </div>

      <CustomerFormModal open={editOpen} onClose={() => setEditOpen(false)} customer={customer} />
    </>
  );
}

// ============== subcomponentes ==============

function Metric({ eyebrow, value, mono }: { eyebrow: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="label-eyebrow">{eyebrow}</div>
      <div className={cn('mt-2 text-2xl text-onyx leading-none', mono ? 'font-mono' : 'display')}>{value}</div>
    </div>
  );
}

function ContactLine({
  icon: Icon, label, value, mono,
}: { icon: React.ElementType; label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-3.5 w-3.5 text-smoke mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-2xs uppercase tracking-micro text-smoke">{label}</div>
        <div className={cn('text-sm text-onyx truncate', mono && 'font-mono')}>
          {value || <span className="text-smoke/50">—</span>}
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-2xs uppercase tracking-micro text-smoke">{label}</span>
      <span className="text-onyx">{children}</span>
    </div>
  );
}
