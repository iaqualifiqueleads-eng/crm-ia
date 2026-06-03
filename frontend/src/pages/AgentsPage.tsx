import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Sparkles, Edit3, Trash2, PlayCircle, BarChart3, Star, Bot, Power,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import { useAgents, useDeleteAgent } from '@/features/agents/useAgents';
import { AgentFormModal } from '@/features/agents/AgentFormModal';
import { providerLabel, providerTone, formatTools, toolNameToLabel } from '@/features/agents/agent-helpers';
import { useAuthStore } from '@/store/auth.store';
import { cn, formatDate } from '@/lib/utils';
import type { Agent } from '@/types/domain';

export function AgentsPage() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const canManage = role === 'MANAGER' || role === 'SUPERVISOR';

  const [createOpen, setCreateOpen] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);

  const { data, isLoading } = useAgents({ limit: 50 });
  const remove = useDeleteAgent();

  return (
    <>
      <PageHeader
        eyebrow="Inteligência"
        title="Agentes de IA"
        description={
          canManage
            ? 'Cada agente é uma persona configurável que conversa com o cliente no WhatsApp. Pode usar Claude, GPT ou Gemini.'
            : 'Visualização dos agentes ativos. Apenas gerentes e supervisores podem editar.'
        }
        actions={
          canManage && (
            <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
              Novo agente
            </Button>
          )
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        </div>
      ) : (data?.data.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum agente configurado"
            description="Crie um agente para que a IA possa conversar com clientes no WhatsApp."
            icon={<Bot className="h-10 w-10" />}
            action={
              canManage && (
                <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                  Criar primeiro agente
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data!.data.map((agent, i) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              index={i}
              canManage={canManage}
              onEdit={() => setEditAgent(agent)}
              onPlayground={() => navigate(`/agents/${agent.id}/playground`)}
              onUsage={() => navigate(`/agents/${agent.id}/usage`)}
              onDelete={() => {
                if (confirm(`Remover agente "${agent.name}"?`)) remove.mutate(agent.id);
              }}
            />
          ))}
        </div>
      )}

      <AgentFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <AgentFormModal
        open={!!editAgent}
        onClose={() => setEditAgent(null)}
        agent={editAgent}
      />
    </>
  );
}

function AgentCard({
  agent, index, canManage, onEdit, onPlayground, onUsage, onDelete,
}: {
  agent: Agent;
  index: number;
  canManage: boolean;
  onEdit: () => void;
  onPlayground: () => void;
  onUsage: () => void;
  onDelete: () => void;
}) {
  const tools = formatTools(agent.enabledTools);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        'group relative bg-pearl border rounded-sharp p-5 shadow-card',
        'hover:shadow-lift transition-shadow duration-200',
        !agent.isActive && 'opacity-60',
        agent.isDefault ? 'border-champagne' : 'border-platinum-100/70',
      )}
    >
      {/* Acento lateral para default */}
      {agent.isDefault && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-champagne" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Chip tone={providerTone[agent.provider]}>
              {providerLabel[agent.provider]} · {agent.model}
            </Chip>
            {agent.isDefault && (
              <Chip tone="champagne">
                <Star className="h-3 w-3 inline mr-0.5" />
                Default
              </Chip>
            )}
            {!agent.isActive && <Chip tone="neutral">Inativo</Chip>}
          </div>
          <h3 className="display text-lg text-onyx truncate">{agent.name}</h3>
          {agent.description && (
            <p className="text-sm text-smoke mt-1 line-clamp-1">{agent.description}</p>
          )}
        </div>
      </div>

      {/* Preview do system prompt */}
      <div className="bg-onyx/[0.02] border-l-2 border-champagne/40 pl-3 pr-2 py-2 mb-3">
        <p className="text-xs text-graphite leading-relaxed line-clamp-2 font-mono">
          {agent.systemPrompt}
        </p>
      </div>

      {/* Tools chips */}
      {tools.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {tools.slice(0, 4).map((t) => (
            <span
              key={t}
              className="text-2xs uppercase tracking-micro px-1.5 py-0.5 bg-platinum-50 text-graphite border border-platinum-100 rounded-sharp"
            >
              {toolNameToLabel(t)}
            </span>
          ))}
          {tools.length > 4 && (
            <span className="text-2xs uppercase tracking-micro px-1.5 py-0.5 text-smoke">
              +{tools.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Métricas + ações */}
      <div className="flex items-center justify-between border-t border-platinum-100/60 pt-3 mt-auto">
        <div className="text-2xs text-smoke">
          <Sparkles className="h-3 w-3 inline mr-1 text-champagne" />
          {agent._count?.customers ?? 0} {agent._count?.customers === 1 ? 'cliente' : 'clientes'}
          {' · '}
          <span className="font-mono">temp {agent.temperature.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onPlayground} className="p-1.5 text-smoke hover:text-onyx" title="Testar">
            <PlayCircle className="h-4 w-4" />
          </button>
          <button onClick={onUsage} className="p-1.5 text-smoke hover:text-onyx" title="Uso">
            <BarChart3 className="h-3.5 w-3.5" />
          </button>
          {canManage && (
            <>
              <button onClick={onEdit} className="p-1.5 text-smoke hover:text-onyx" title="Editar">
                <Edit3 className="h-3.5 w-3.5" />
              </button>
              {!agent.isDefault && (
                <button onClick={onDelete} className="p-1.5 text-smoke hover:text-signal" title="Remover">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
