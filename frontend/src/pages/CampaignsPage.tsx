import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Megaphone, Pause, Play, Trash2, ChevronRight,
  CheckCircle2, XCircle, Clock, AlertTriangle, Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import {
  useCampaigns, usePauseCampaign, useResumeCampaign, useDeleteCampaign,
} from '@/features/campaigns/useCampaigns';
import { CampaignCreateModal } from '@/features/campaigns/CampaignCreateModal';
import { formatDate, cn } from '@/lib/utils';
import type { Campaign, CampaignStatus } from '@/types/domain';

// ── Status helpers ──────────────────────────────────────────────────────────

const statusLabel: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho',
  RUNNING: 'Em andamento',
  PAUSED: 'Pausada',
  DONE: 'Concluída',
  CANCELLED: 'Cancelada',
};

const statusTone: Record<CampaignStatus, 'champagne' | 'signal' | 'neutral' | 'forest'> = {
  DRAFT: 'neutral',
  RUNNING: 'champagne',
  PAUSED: 'neutral',
  DONE: 'forest',
  CANCELLED: 'signal',
};

function ProgressBar({ campaign }: { campaign: Campaign }) {
  const processed = campaign.sentCount + campaign.failedCount + campaign.skippedCount;
  const total = campaign.totalCustomers;
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-2xs text-smoke tabular-nums">
        <span>{processed} / {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1 bg-platinum-100 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            campaign.status === 'DONE' ? 'bg-emerald-500' :
            campaign.status === 'PAUSED' ? 'bg-amber-400' :
            'bg-onyx',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const navigate = useNavigate();
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const remove = useDeleteCampaign();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filters = (() => {
    try { return JSON.parse(campaign.filters); } catch { return {}; }
  })();

  const filterSummary = [
    filters.state && `UF: ${filters.state}`,
    filters.lastInteractionBefore && `Sem interação desde ${formatDate(filters.lastInteractionBefore)}`,
  ].filter(Boolean).join(' · ') || 'Sem filtros definidos';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card className="hover:border-onyx/20 transition-colors cursor-pointer" onClick={() => navigate(`/campaigns/${campaign.id}`)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Chip tone={statusTone[campaign.status]} className="text-xs">
                  {statusLabel[campaign.status]}
                </Chip>
                <span className="text-2xs text-smoke">{formatDate(campaign.createdAt)}</span>
              </div>

              <h3 className="text-sm font-medium text-onyx truncate">{campaign.name}</h3>
              <p className="text-xs text-smoke mt-0.5 truncate">{filterSummary}</p>

              {campaign.template && (
                <p className="text-xs text-graphite mt-1">
                  Template: <span className="font-medium">{campaign.template.name}</span>
                </p>
              )}
            </div>

            {/* Contadores */}
            <div className="flex items-center gap-4 shrink-0 text-xs">
              <div className="flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="tabular-nums font-medium">{campaign.sentCount}</span>
              </div>
              <div className="flex items-center gap-1 text-signal">
                <XCircle className="w-3.5 h-3.5" />
                <span className="tabular-nums font-medium">{campaign.failedCount}</span>
              </div>
              <div className="flex items-center gap-1 text-smoke">
                <Clock className="w-3.5 h-3.5" />
                <span className="tabular-nums font-medium">
                  {campaign.totalCustomers - campaign.sentCount - campaign.failedCount - campaign.skippedCount}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <ProgressBar campaign={campaign} />
          </div>

          {/* Ações */}
          <div
            className="flex items-center gap-2 mt-4 pt-4 border-t border-platinum-100/60"
            onClick={(e) => e.stopPropagation()}
          >
            {campaign.status === 'RUNNING' && (
              <Button
                className="text-xs"
                variant="ghost"
                icon={<Pause className="w-3.5 h-3.5" />}
                onClick={() => pause.mutate(campaign.id)}
                disabled={pause.isPending}
              >
                Pausar
              </Button>
            )}
            {campaign.status === 'PAUSED' && (
              <Button
                className="text-xs"
                variant="ghost"
                icon={<Play className="w-3.5 h-3.5" />}
                onClick={() => resume.mutate(campaign.id)}
                disabled={resume.isPending}
              >
                Retomar
              </Button>
            )}

            {confirmDelete ? (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-signal">Confirmar exclusão?</span>
                <Button
                  className="text-xs"
                  variant="ghost"
                  onClick={() => setConfirmDelete(false)}
                >
                  Não
                </Button>
                <Button
                  className="text-xs"
                  variant="ghost"
                  onClick={() => remove.mutate(campaign.id)}
                  disabled={remove.isPending}
                >
                  Sim, deletar
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                icon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => setConfirmDelete(true)}
                className="ml-auto text-smoke hover:text-signal"
              >
                Deletar
              </Button>
            )}

            <Button
              className="text-xs"
              variant="ghost"
              icon={<ChevronRight className="w-3.5 h-3.5" />}
              onClick={() => navigate(`/campaigns/${campaign.id}`)}
            >
              Detalhes
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export function CampaignsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const { data: campaigns, isLoading } = useCampaigns();

  const active = campaigns?.filter((c) => c.status === 'RUNNING' || c.status === 'PAUSED') ?? [];
  const finished = campaigns?.filter((c) => c.status === 'DONE' || c.status === 'CANCELLED') ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Disparos"
        title="Campanhas"
        description="Selecione segmentos de clientes, escolha um template e dispare mensagens em massa respeitando o intervalo de horário comercial."
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Nova campanha
          </Button>
        }
      />

      <div className="p-6 md:p-8 space-y-8 max-w-5xl">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)}
          </div>
        )}

        {!isLoading && campaigns?.length === 0 && (
          <EmptyState
            icon={<Megaphone className="w-8 h-8 text-smoke" />}
            title="Nenhuma campanha ainda"
            description="Crie sua primeira campanha para disparar mensagens em massa para um segmento de clientes."
            action={
              <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                Nova campanha
              </Button>
            }
          />
        )}

        {active.length > 0 && (
          <section className="space-y-3">
            <h2 className="label-eyebrow text-smoke">Em andamento · {active.length}</h2>
            {active.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </section>
        )}

        {finished.length > 0 && (
          <section className="space-y-3">
            <h2 className="label-eyebrow text-smoke">Histórico · {finished.length}</h2>
            {finished.map((c) => <CampaignCard key={c.id} campaign={c} />)}
          </section>
        )}
      </div>

      <CampaignCreateModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
