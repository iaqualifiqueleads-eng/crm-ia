import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Bell, AlertTriangle, MessageCircle, ArrowRight, Sparkles, CalendarClock, RefreshCw, Package, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/EmptyState';
import { useReplenishmentConfig, useUpdateReplenishmentConfig, useQueueSummary, type ScheduledContact, type PendingJob } from '@/features/automation/useAutomation';
import { useTemplates } from '@/features/templates/useTemplates';
import { cn, formatDate, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { ReplenishmentConfig } from '@/types/domain';

export function AutomationPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isManager = role === 'MANAGER';
  const { data: config, isLoading } = useReplenishmentConfig();
  const { data: templates } = useTemplates({ limit: 100 });
  const update = useUpdateReplenishmentConfig();
  const { data: queue, isLoading: queueLoading, refetch: refetchQueue, isFetching: queueFetching } = useQueueSummary();

  const [form, setForm] = useState<Partial<ReplenishmentConfig>>({});

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const set = <K extends keyof ReplenishmentConfig>(k: K, v: ReplenishmentConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setRetryTemplate = (key: 'retry1' | 'retry2' | 'retry3', v: string) =>
    setForm((f) => ({
      ...f,
      retryTemplateIds: { ...f.retryTemplateIds, [key]: v || undefined },
    }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate(form);
  };

  if (isLoading) {
    return <div className="space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;
  }

  const activeTemplates = templates?.data.filter((t) => t.isActive) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Configuração"
        title="Cadência automática"
        description={
          isManager
            ? 'Defina o ritmo da automação: quando a IA contata o cliente, quantas tentativas, quando escalar para o vendedor.'
            : 'Visualização das regras de cadência (apenas o gerente pode editar).'
        }
      />

      {/* Fila de contatos */}
      <QueueCard
        scheduledContacts={queue?.scheduledContacts ?? []}
        pendingJobs={queue?.pendingJobs ?? []}
        loading={queueLoading}
        fetching={queueFetching}
        onRefresh={() => refetchQueue()}
      />

      {/* Fluxo visual editorial */}
      <Card className="mb-6">
        <CardHeader>
          <div>
            <CardEyebrow>Fluxo da automação</CardEyebrow>
            <CardTitle>Como funciona em produção</CardTitle>
          </div>
          <div className="flex items-center gap-2 text-2xs uppercase tracking-micro">
            <span className={cn(
              'h-1.5 w-1.5 rounded-full',
              form.enabled ? 'bg-forest' : 'bg-smoke/40',
            )} />
            {form.enabled ? 'Ativa' : 'Pausada'}
          </div>
        </CardHeader>
        <CardContent>
          <FlowDiagram config={form} />
        </CardContent>
      </Card>

      {/* Formulário */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Liga/desliga */}
        <Card>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <div className="display text-lg text-onyx">Automação ativa</div>
              <p className="text-sm text-smoke mt-1">
                Quando desligada, a IA não envia mensagens e os workers ficam ociosos.
                Mensagens já enfileiradas continuam até o ciclo terminar.
              </p>
            </div>
            <label className="inline-flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={!!form.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
                disabled={!isManager}
                className="h-5 w-5 accent-onyx"
              />
              <span className="font-mono text-xs text-graphite">
                {form.enabled ? 'ATIVA' : 'PAUSADA'}
              </span>
            </label>
          </CardContent>
        </Card>

        {/* Timing */}
        <Card>
          <CardHeader>
            <div>
              <CardEyebrow>Timing</CardEyebrow>
              <CardTitle>Quando contatar o cliente</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label>Antecedência (dias)</Label>
              <Input
                type="number" min={0} max={30}
                value={form.remindBeforeDays ?? 0}
                onChange={(e) => set('remindBeforeDays', Number(e.target.value))}
                disabled={!isManager}
              />
              <p className="text-2xs text-smoke mt-1.5">
                Quantos dias antes da reposição prevista a IA inicia o contato. 0 = no dia.
              </p>
            </div>

            <div>
              <Label>Retries (horas, separadas por vírgula)</Label>
              <Input
                value={(form.retryDelaysHours ?? [1, 3, 24]).join(', ')}
                onChange={(e) => {
                  const nums = e.target.value.split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
                  if (nums.length === 3) set('retryDelaysHours', nums as [number, number, number]);
                }}
                placeholder="1, 3, 24"
                className="font-mono"
                disabled={!isManager}
              />
              <p className="text-2xs text-smoke mt-1.5">
                Sequência de espera antes de cada reenvio. Padrão: 1h, 3h, 24h.
              </p>
            </div>

            <div>
              <Label>Tarefa urgente após X dias de atraso</Label>
              <Input
                type="number" min={0} max={30}
                value={form.overdueTaskAfterDays ?? 1}
                onChange={(e) => set('overdueTaskAfterDays', Number(e.target.value))}
                disabled={!isManager}
              />
            </div>

            <div>
              <Label>Escalar p/ gerência após X dias</Label>
              <Input
                type="number" min={0} max={60}
                value={form.escalateToManagementAfterDays ?? 3}
                onChange={(e) => set('escalateToManagementAfterDays', Number(e.target.value))}
                disabled={!isManager}
              />
              <p className="text-2xs text-smoke mt-1.5">
                Quando notificar supervisor e gerente sobre o atraso.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Templates */}
        <Card>
          <CardHeader>
            <div>
              <CardEyebrow>Templates</CardEyebrow>
              <CardTitle>Mensagens usadas em cada etapa</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <TemplateSelect
              label="Lembrete inicial (no dia previsto)"
              icon={Bell}
              value={form.defaultReminderTemplateId ?? ''}
              onChange={(v) => set('defaultReminderTemplateId', v || undefined)}
              templates={activeTemplates}
              filterTrigger="REPLENISHMENT_REMINDER"
              disabled={!isManager}
            />
            <TemplateSelect
              label="Retry 1 — sem resposta"
              icon={MessageCircle}
              value={form.retryTemplateIds?.retry1 ?? ''}
              onChange={(v) => setRetryTemplate('retry1', v)}
              templates={activeTemplates}
              filterTrigger="RETRY_1"
              disabled={!isManager}
            />
            <TemplateSelect
              label="Retry 2 — segunda tentativa"
              icon={MessageCircle}
              value={form.retryTemplateIds?.retry2 ?? ''}
              onChange={(v) => setRetryTemplate('retry2', v)}
              templates={activeTemplates}
              filterTrigger="RETRY_2"
              disabled={!isManager}
            />
            <TemplateSelect
              label="Retry 3 — última tentativa IA"
              icon={MessageCircle}
              value={form.retryTemplateIds?.retry3 ?? ''}
              onChange={(v) => setRetryTemplate('retry3', v)}
              templates={activeTemplates}
              filterTrigger="RETRY_3"
              disabled={!isManager}
            />
            <TemplateSelect
              label="Cliente atrasado"
              icon={AlertTriangle}
              value={form.overdueTemplateId ?? ''}
              onChange={(v) => set('overdueTemplateId', v || undefined)}
              templates={activeTemplates}
              filterTrigger="REPLENISHMENT_OVERDUE"
              disabled={!isManager}
            />
          </CardContent>
        </Card>

        {isManager && (
          <div className="flex justify-end">
            <Button type="submit" loading={update.isPending} size="lg">
              Salvar configuração
            </Button>
          </div>
        )}
      </form>
    </>
  );
}

// ============== Sub-componentes ==============

const JOB_LABEL: Record<string, string> = {
  'send-reminder': 'Lembrete inicial',
  'check-retry':   'Retry pendente',
  'daily-scan':    'Varredura diária',
  'daily-overdue': 'Varredura atrasos',
};

const QUEUE_LABEL: Record<string, string> = {
  'replenishment':      'Reposição',
  'message-retry':      'Retry',
  'overdue-escalation': 'Escalação',
};

function QueueCard({
  scheduledContacts,
  pendingJobs,
  loading,
  fetching,
  onRefresh,
}: {
  scheduledContacts: ScheduledContact[];
  pendingJobs: PendingJob[];
  loading: boolean;
  fetching: boolean;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<'contacts' | 'jobs'>('contacts');

  return (
    <Card className="mb-6">
      <CardHeader>
        <div>
          <CardEyebrow>Fila de contatos</CardEyebrow>
          <CardTitle>Agendamentos e jobs pendentes</CardTitle>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<RefreshCw className={cn('w-3.5 h-3.5', fetching && 'animate-spin')} />}
          onClick={onRefresh}
          type="button"
        >
          Atualizar
        </Button>
      </CardHeader>

      {/* Tabs */}
      <div className="flex border-b border-platinum-100/80 px-5">
        {([
          { key: 'contacts', label: `Contatos agendados (${scheduledContacts.length})`, icon: CalendarClock },
          { key: 'jobs',     label: `Jobs BullMQ (${pendingJobs.length})`,               icon: RotateCcw },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 -mb-px transition-colors',
              tab === key
                ? 'border-onyx text-onyx'
                : 'border-transparent text-smoke hover:text-graphite',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <CardContent className="p-0">
        {loading ? (
          <div className="p-5 space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : tab === 'contacts' ? (
          scheduledContacts.length === 0 ? (
            <p className="text-sm text-smoke text-center py-10">Nenhum contato agendado</p>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-platinum-50/90 border-b border-platinum-100">
                  <tr>
                    {['Cliente', 'Previsão de contato', 'Responsável', 'Modo'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-2xs uppercase tracking-micro text-smoke font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-platinum-100/60">
                  {scheduledContacts.map((c) => (
                    <tr key={c.id} className="hover:bg-platinum-50/40">
                      <td className="px-5 py-3">
                        <Link
                          to={`/customers/${c.id}`}
                          className="font-medium text-onyx hover:underline underline-offset-2"
                        >
                          {c.companyName}
                        </Link>
                      </td>
                      <td className="px-5 py-3 font-mono text-sm tabular-nums text-graphite">
                        {formatDate(c.nextReplenishmentAt)}
                      </td>
                      <td className="px-5 py-3 text-graphite">
                        {c.salesperson?.name ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        {c.forecastMode === 'MANUAL' ? (
                          <span className="inline-flex items-center gap-1 text-2xs px-2 py-0.5 rounded bg-champagne text-onyx font-medium">
                            <Package className="w-3 h-3" />
                            Bem estocado{c.manualIntervalDays ? ` · ${c.manualIntervalDays}d` : ''}
                          </span>
                        ) : (
                          <span className="text-2xs text-smoke">Auto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          pendingJobs.length === 0 ? (
            <p className="text-sm text-smoke text-center py-10">Nenhum job pendente no BullMQ</p>
          ) : (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-platinum-50/90 border-b border-platinum-100">
                  <tr>
                    {['Cliente', 'Job', 'Fila', 'Executa em', 'Retry'].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-2xs uppercase tracking-micro text-smoke font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-platinum-100/60">
                  {pendingJobs.map((j) => (
                    <tr key={j.id} className="hover:bg-platinum-50/40">
                      <td className="px-5 py-3">
                        {j.customerId ? (
                          <Link
                            to={`/customers/${j.customerId}`}
                            className="font-medium text-onyx hover:underline underline-offset-2"
                          >
                            {j.companyName ?? j.customerId}
                          </Link>
                        ) : (
                          <span className="text-smoke text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-graphite">
                        {JOB_LABEL[j.name] ?? j.name}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-2xs px-2 py-0.5 rounded bg-platinum-100 text-graphite font-mono">
                          {QUEUE_LABEL[j.queue] ?? j.queue}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs tabular-nums text-graphite">
                        {formatDateTime(j.processAt)}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs text-smoke">
                        {j.retryStep != null ? `${j.retryStep}/3` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}

function TemplateSelect({
  label, icon: Icon, value, onChange, templates, filterTrigger, disabled,
}: {
  label: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  templates: { id: string; name: string; trigger: string }[];
  filterTrigger: string;
  disabled?: boolean;
}) {
  // Mostra os do trigger correspondente primeiro, depois os outros
  const sorted = [...templates].sort((a, b) => {
    if (a.trigger === filterTrigger && b.trigger !== filterTrigger) return -1;
    if (b.trigger === filterTrigger && a.trigger !== filterTrigger) return 1;
    return 0;
  });

  return (
    <div className="flex items-start gap-4">
      <Icon className="h-4 w-4 text-smoke mt-3 shrink-0" />
      <div className="flex-1">
        <Label>{label}</Label>
        <Select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          <option value="">— Nenhum (etapa pulada) —</option>
          {sorted.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} {t.trigger === filterTrigger && '✓'}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}

function FlowDiagram({ config }: { config: Partial<ReplenishmentConfig> }) {
  const retries = config.retryDelaysHours ?? [1, 3, 24];
  const steps = [
    { title: 'Dia previsto', subtitle: `D-${config.remindBeforeDays ?? 0}`, icon: Bell, tone: 'champagne' as const },
    { title: 'Retry 1', subtitle: `+${retries[0]}h`, icon: MessageCircle, tone: 'neutral' as const },
    { title: 'Retry 2', subtitle: `+${retries[1]}h`, icon: MessageCircle, tone: 'neutral' as const },
    { title: 'Retry 3', subtitle: `+${retries[2]}h`, icon: MessageCircle, tone: 'neutral' as const },
    { title: 'Tarefa urgente', subtitle: `+${config.overdueTaskAfterDays ?? 1}d`, icon: AlertTriangle, tone: 'signal' as const },
    { title: 'Escalar', subtitle: `+${config.escalateToManagementAfterDays ?? 3}d`, icon: Sparkles, tone: 'signal' as const },
  ];

  const toneMap = {
    champagne: 'bg-champagne text-onyx border-champagne',
    neutral:   'bg-pearl text-onyx border-platinum-100',
    signal:    'bg-signal/10 text-signal border-signal/30',
  };

  return (
    <div className="flex items-stretch gap-1 overflow-x-auto pb-2 -mx-2 px-2">
      {steps.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="flex items-center shrink-0">
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={cn(
                'flex flex-col items-center text-center px-4 py-3 rounded-sharp border min-w-[110px]',
                toneMap[s.tone],
              )}
            >
              <Icon className="h-4 w-4 mb-2" />
              <div className="text-xs font-medium">{s.title}</div>
              <div className="text-2xs font-mono opacity-70 mt-0.5">{s.subtitle}</div>
            </motion.div>
            {i < steps.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 text-smoke/40 mx-1 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}
