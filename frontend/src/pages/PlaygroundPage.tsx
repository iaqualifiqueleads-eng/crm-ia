import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, ChevronLeft, Sparkles, AlertTriangle, Wrench, X, Bot,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardEyebrow, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Label, Textarea } from '@/components/ui/Input';
import { CustomerCombobox } from '@/components/ui/CustomerCombobox';
import { Skeleton } from '@/components/ui/EmptyState';
import { useAgent, usePlayground } from '@/features/agents/useAgents';
import { providerLabel, providerTone, toolNameToLabel } from '@/features/agents/agent-helpers';
import { cn, formatCurrency, getInitials } from '@/lib/utils';

interface ChatTurn {
  id: number;
  user: string;
  agent?: string;
  toolCalls?: Array<{ name: string; summary: string }>;
  ended?: boolean;
  transferReason?: string;
  loading?: boolean;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costBrl: number;
    llmCalls: number;
    latencyMs: number;
  };
}

export function PlaygroundPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: agent, isLoading } = useAgent(id);
  const playground = usePlayground(id ?? '');

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const totalCostBrl = turns.reduce((acc, t) => acc + (t.usage?.costBrl ?? 0), 0);
  const totalTokens  = turns.reduce((acc, t) => acc + (t.usage?.totalTokens ?? 0), 0);

  const sendMessage = async () => {
    if (!input.trim() || !customerId || !id) return;
    const text = input.trim();
    setInput('');

    const turnId = Date.now();
    setTurns((arr) => [...arr, { id: turnId, user: text, loading: true }]);

    try {
      const result = await playground.mutateAsync({ message: text, customerId });
      setTurns((arr) => arr.map((t) =>
        t.id === turnId
          ? {
              ...t,
              loading: false,
              agent: result.responseText,
              toolCalls: result.toolCallsSummary,
              ended: result.ended,
              transferReason: result.transferReason,
              usage: result.usage,
            }
          : t,
      ));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setTurns((arr) => arr.map((t) =>
        t.id === turnId ? { ...t, loading: false, error: msg } : t,
      ));
    }
  };

  const reset = () => setTurns([]);

  if (isLoading) return <Skeleton className="h-96" />;
  if (!agent) return null;

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => navigate('/agents')} icon={<ChevronLeft className="h-4 w-4" />} className="mb-3">
        Voltar para agentes
      </Button>

      <PageHeader
        eyebrow="Playground"
        title={agent.name}
        description="Converse com o agente como se fosse um cliente. Nada é enviado pelo WhatsApp e o histórico não fica no CRM."
        actions={
          <>
            <Chip tone={providerTone[agent.provider]}>
              {providerLabel[agent.provider]} · {agent.model}
            </Chip>
            {turns.length > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} icon={<X className="h-3.5 w-3.5" />}>
                Limpar conversa
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* CHAT */}
        <Card className="lg:col-span-3 overflow-hidden">
          <CardHeader className="border-b border-platinum-100">
            <div className="w-full">
              <CardEyebrow>Cliente a simular</CardEyebrow>
              <div className="mt-2">
                <CustomerCombobox
                  value={customerId}
                  onChange={(idVal) => setCustomerId(idVal)}
                  label=""
                />
              </div>
            </div>
          </CardHeader>

          {/* Stream */}
          <div className="bg-onyx/[0.02] min-h-[420px] max-h-[60vh] overflow-y-auto p-6 space-y-5">
            {turns.length === 0 && customerId && (
              <div className="flex flex-col items-center justify-center text-center text-smoke py-16">
                <Bot className="h-10 w-10 mb-4 text-champagne/60" />
                <p className="text-sm">Mande uma mensagem para iniciar a conversa.</p>
                <p className="text-2xs mt-2">Tente algo como "oi, queria saber preço de PVC".</p>
              </div>
            )}

            {turns.length === 0 && !customerId && (
              <div className="flex flex-col items-center justify-center text-center text-smoke py-16">
                <Sparkles className="h-10 w-10 mb-4 text-platinum-100" />
                <p className="text-sm">Escolha um cliente acima para começar.</p>
                <p className="text-2xs mt-2">O agente usa o contexto do cliente (status, atraso, último pedido).</p>
              </div>
            )}

            <AnimatePresence initial={false}>
              {turns.map((turn) => (
                <motion.div
                  key={turn.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  {/* Bubble user */}
                  <div className="flex justify-end">
                    <div className="max-w-[75%] bg-onyx text-pearl px-4 py-2.5 rounded-sharp">
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{turn.user}</p>
                    </div>
                  </div>

                  {/* Loading */}
                  {turn.loading && (
                    <div className="flex items-center gap-2">
                      <span className="h-7 w-7 rounded-sharp bg-champagne/20 text-champagne text-2xs font-mono inline-flex items-center justify-center">
                        IA
                      </span>
                      <span className="text-2xs text-smoke">pensando...</span>
                      <div className="flex gap-1">
                        {[0, 1, 2].map((i) => (
                          <motion.span
                            key={i}
                            className="h-1 w-1 rounded-full bg-champagne"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tool calls */}
                  {turn.toolCalls && turn.toolCalls.length > 0 && (
                    <div className="ml-9 space-y-1">
                      {turn.toolCalls.map((tc, i) => (
                        <div
                          key={i}
                          className="inline-flex items-center gap-2 px-2.5 py-1 bg-champagne/[0.08] border border-champagne/20 rounded-sharp"
                        >
                          <Wrench className="h-3 w-3 text-champagne" />
                          <span className="text-2xs uppercase tracking-micro text-champagne-100">
                            {toolNameToLabel(tc.name)}
                          </span>
                          <span className="text-2xs text-graphite">→ {tc.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Bubble agent */}
                  {turn.agent && (
                    <div className="flex items-start gap-2">
                      <span className="h-7 w-7 rounded-sharp bg-champagne/20 text-champagne-100 text-2xs font-mono inline-flex items-center justify-center shrink-0 mt-0.5">
                        IA
                      </span>
                      <div className="max-w-[75%] bg-pearl border border-platinum-100/60 px-4 py-2.5 rounded-sharp">
                        <p className="text-sm text-onyx leading-relaxed whitespace-pre-wrap">
                          {turn.agent}
                        </p>
                        {turn.usage && (
                          <div className="text-2xs text-smoke/60 mt-2 font-mono">
                            {turn.usage.totalTokens} tokens · {formatCurrency(turn.usage.costBrl)} ·{' '}
                            {turn.usage.latencyMs}ms
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Transferência */}
                  {turn.ended && (
                    <div className="ml-9 inline-flex items-center gap-2 px-3 py-1.5 bg-signal/[0.06] border border-signal/20 rounded-sharp text-2xs text-signal">
                      <AlertTriangle className="h-3 w-3" />
                      Conversa encerrada{turn.transferReason ? ` · ${turn.transferReason}` : ''}
                    </div>
                  )}

                  {/* Erro */}
                  {turn.error && (
                    <div className="ml-9 px-3 py-2 bg-signal/[0.06] border border-signal/30 rounded-sharp text-xs text-signal">
                      {turn.error}
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t border-platinum-100 p-4 bg-pearl">
            <div className="flex gap-2 items-end">
              <Textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={customerId ? 'Digite como se fosse o cliente...' : 'Selecione um cliente primeiro'}
                disabled={!customerId || playground.isPending}
                className="resize-none"
              />
              <Button
                onClick={sendMessage}
                loading={playground.isPending}
                disabled={!input.trim() || !customerId}
                icon={<Send className="h-4 w-4" />}
              >
                Enviar
              </Button>
            </div>
            <p className="text-2xs text-smoke mt-2">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </Card>

        {/* SIDEBAR */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Sessão</CardEyebrow>
                <CardTitle className="text-base">Custo acumulado</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="display text-3xl text-onyx font-mono tabular-nums">
                {formatCurrency(totalCostBrl)}
              </div>
              <p className="text-2xs text-smoke mt-1">
                {totalTokens.toLocaleString('pt-BR')} tokens em {turns.length} {turns.length === 1 ? 'turno' : 'turnos'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardEyebrow>Configuração</CardEyebrow>
                <CardTitle className="text-base">Parâmetros</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <Row label="Modelo" value={agent.model} mono />
              <Row label="Temperature" value={agent.temperature.toFixed(2)} mono />
              <Row label="Max tokens" value={agent.maxTokens.toString()} mono />
              <Row label="Tools" value={`${(agent.enabledTools ?? '').split(',').filter(Boolean).length} ativas`} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-platinum-100/40 pb-1.5 last:border-b-0">
      <span className="text-smoke uppercase tracking-micro text-2xs">{label}</span>
      <span className={cn('text-graphite text-xs', mono && 'font-mono tabular-nums')}>{value}</span>
    </div>
  );
}
