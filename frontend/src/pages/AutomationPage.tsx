import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Bell, AlertTriangle, MessageCircle, ArrowRight, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/EmptyState';
import { useReplenishmentConfig, useUpdateReplenishmentConfig } from '@/features/automation/useAutomation';
import { useTemplates } from '@/features/templates/useTemplates';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import type { ReplenishmentConfig } from '@/types/domain';

export function AutomationPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isManager = role === 'MANAGER';
  const { data: config, isLoading } = useReplenishmentConfig();
  const { data: templates } = useTemplates({ limit: 100 });
  const update = useUpdateReplenishmentConfig();

  const [form, setForm] = useState<Partial<ReplenishmentConfig>>({});

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const set = <K extends keyof ReplenishmentConfig>(k: K, v: ReplenishmentConfig[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const setRetryTemplate = (key: 'retry1h' | 'retry3h' | 'retry24h', v: string) =>
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
              label="Retry 1h — sem resposta"
              icon={MessageCircle}
              value={form.retryTemplateIds?.retry1h ?? ''}
              onChange={(v) => setRetryTemplate('retry1h', v)}
              templates={activeTemplates}
              filterTrigger="RETRY_1H"
              disabled={!isManager}
            />
            <TemplateSelect
              label="Retry 3h — segunda tentativa"
              icon={MessageCircle}
              value={form.retryTemplateIds?.retry3h ?? ''}
              onChange={(v) => setRetryTemplate('retry3h', v)}
              templates={activeTemplates}
              filterTrigger="RETRY_3H"
              disabled={!isManager}
            />
            <TemplateSelect
              label="Retry 24h — última tentativa IA"
              icon={MessageCircle}
              value={form.retryTemplateIds?.retry24h ?? ''}
              onChange={(v) => setRetryTemplate('retry24h', v)}
              templates={activeTemplates}
              filterTrigger="RETRY_24H"
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
