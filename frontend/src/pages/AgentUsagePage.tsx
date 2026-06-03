import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, TrendingUp, Activity, DollarSign, Hash } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Skeleton } from '@/components/ui/EmptyState';
import { useAgent, useAgentUsage } from '@/features/agents/useAgents';
import { providerLabel, providerTone } from '@/features/agents/agent-helpers';
import { cn, formatCurrency, formatDate } from '@/lib/utils';

const periods = [
  { value: 7,   label: '7 dias' },
  { value: 30,  label: '30 dias' },
  { value: 90,  label: '90 dias' },
];

export function AgentUsagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [days, setDays] = useState(30);

  const { data: agent } = useAgent(id);
  const { data: usage, isLoading } = useAgentUsage(id, days);

  const chartData = (usage?.daily ?? []).map((d) => ({
    day: typeof d.day === 'string' ? d.day.slice(5) : formatDate(d.day as any).slice(0, 5),
    calls: d.total,
    cost: Number(d.costBrl),
  }));

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/agents')}
        icon={<ChevronLeft className="h-4 w-4" />}
        className="mb-3"
      >
        Voltar para agentes
      </Button>

      <PageHeader
        eyebrow="Telemetria"
        title={agent ? `Uso · ${agent.name}` : 'Uso do agente'}
        description="Tokens consumidos, custo em BRL e latência média do agente."
        actions={
          <>
            {agent && (
              <Chip tone={providerTone[agent.provider]}>
                {providerLabel[agent.provider]} · {agent.model}
              </Chip>
            )}
            <div className="inline-flex border border-platinum-100 rounded-sharp">
              {periods.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setDays(p.value)}
                  className={cn(
                    'px-3 py-1.5 text-xs transition-colors',
                    days === p.value
                      ? 'bg-onyx text-pearl'
                      : 'text-graphite hover:bg-platinum-50/60',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          {/* MÉTRICAS */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Metric
              eyebrow="Total"
              label="Chamadas"
              value={(usage?.totalCalls ?? 0).toLocaleString('pt-BR')}
              icon={<Hash className="h-4 w-4" />}
              tone="default"
            />
            <Metric
              eyebrow="Consumo"
              label="Tokens"
              value={(usage?.totalTokens ?? 0).toLocaleString('pt-BR')}
              sub={`${(usage?.promptTokens ?? 0).toLocaleString('pt-BR')} in · ${(usage?.completionTokens ?? 0).toLocaleString('pt-BR')} out`}
              icon={<Activity className="h-4 w-4" />}
              tone="default"
            />
            <Metric
              eyebrow="Custo"
              label="Total BRL"
              value={formatCurrency(usage?.costBrl ?? 0)}
              sub={`≈ US$ ${Number(usage?.costUsd ?? 0).toFixed(4)}`}
              icon={<DollarSign className="h-4 w-4" />}
              tone="champagne"
            />
            <Metric
              eyebrow="Performance"
              label="Latência média"
              value={`${usage?.avgLatencyMs ?? 0} ms`}
              icon={<TrendingUp className="h-4 w-4" />}
              tone="default"
            />
          </div>

          {/* GRÁFICO */}
          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Evolução diária</CardEyebrow>
                <CardTitle>Chamadas e custo por dia</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="h-80 pt-4">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-sm text-smoke">
                  Sem dados no período.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callsArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C9A961" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#C9A961" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#E8E6E1" strokeDasharray="0" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fill: '#76767D', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={{ stroke: '#E8E6E1' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#76767D', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}
                      axisLine={{ stroke: '#E8E6E1' }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: '#0A0A0B',
                        border: '1px solid #2A2A2F',
                        borderRadius: 2,
                        color: '#FAFAF7',
                        fontSize: 12,
                      }}
                      formatter={(value: any, name: any) => {
                        if (name === 'cost') return [formatCurrency(value), 'Custo'];
                        return [value, 'Chamadas'];
                      }}
                      labelStyle={{ color: '#C9A961' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="#C9A961"
                      strokeWidth={1.5}
                      fill="url(#callsArea)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}

function Metric({
  eyebrow, label, value, sub, icon, tone,
}: {
  eyebrow: string;
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: 'default' | 'champagne';
}) {
  return (
    <div className={cn(
      'bg-pearl border rounded-sharp p-4 shadow-card',
      tone === 'champagne' ? 'border-champagne/40 bg-champagne/[0.03]' : 'border-platinum-100/70',
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs uppercase tracking-micro text-smoke">{eyebrow}</span>
        <span className={cn(tone === 'champagne' ? 'text-champagne' : 'text-platinum-100')}>
          {icon}
        </span>
      </div>
      <div className="text-xs text-graphite mb-1">{label}</div>
      <div className="display text-2xl text-onyx font-mono tabular-nums">{value}</div>
      {sub && <div className="text-2xs text-smoke mt-1 font-mono">{sub}</div>}
    </div>
  );
}
