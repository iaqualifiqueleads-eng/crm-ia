import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, XCircle, Clock, Loader2,
  Pause, Play, Trash2, UserX, AlertTriangle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import {
  useCampaign, usePauseCampaign, useResumeCampaign,
  useDeleteCampaign, useRemoveCampaignCustomer,
} from '@/features/campaigns/useCampaigns';
import { formatDate, cn } from '@/lib/utils';
import type { CampaignCustomerStatus, CampaignStatus } from '@/types/domain';

// ── Helpers ────────────────────────────────────────────────────────────────

const statusLabel: Record<CampaignStatus, string> = {
  DRAFT: 'Rascunho', RUNNING: 'Em andamento',
  PAUSED: 'Pausada', DONE: 'Concluída', CANCELLED: 'Cancelada',
};
const statusTone: Record<CampaignStatus, 'champagne' | 'signal' | 'neutral' | 'forest'> = {
  DRAFT: 'neutral', RUNNING: 'champagne', PAUSED: 'neutral', DONE: 'forest', CANCELLED: 'signal',
};

const ccStatusIcon: Record<CampaignCustomerStatus, React.ReactNode> = {
  PENDING:  <Clock className="w-3.5 h-3.5 text-smoke" />,
  SENT:     <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  FAILED:   <XCircle className="w-3.5 h-3.5 text-signal" />,
  SKIPPED:  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
};
const ccStatusLabel: Record<CampaignCustomerStatus, string> = {
  PENDING: 'Aguardando', SENT: 'Enviado', FAILED: 'Falhou', SKIPPED: 'Ignorado',
};

// ── Page ───────────────────────────────────────────────────────────────────

export function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id!);
  const pause = usePauseCampaign();
  const resume = useResumeCampaign();
  const remove = useDeleteCampaign();
  const removeCustomer = useRemoveCampaignCustomer();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removingCustomerId, setRemovingCustomerId] = useState<string | null>(null);

  const handleDeleteCampaign = async () => {
    await remove.mutateAsync(id!);
    navigate('/campaigns');
  };

  const handleRemoveCustomer = async (customerId: string) => {
    setRemovingCustomerId(customerId);
    try {
      await removeCustomer.mutateAsync({ campaignId: id!, customerId });
    } finally {
      setRemovingCustomerId(null);
    }
  };

  const filters = (() => {
    try { return JSON.parse(campaign?.filters ?? '{}'); } catch { return {}; }
  })();

  const canMutate = campaign?.status === 'RUNNING' || campaign?.status === 'PAUSED';

  return (
    <>
      <PageHeader
        eyebrow="Campanhas"
        title={campaign?.name ?? 'Carregando…'}
        description={
          campaign
            ? [
                filters.state && `UF: ${filters.state}`,
                filters.lastInteractionBefore && `Sem interação desde ${formatDate(filters.lastInteractionBefore)}`,
              ].filter(Boolean).join(' · ') || 'Sem filtros adicionais'
            : undefined
        }
        actions={
          campaign && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={() => navigate('/campaigns')} icon={<ArrowLeft className="w-4 h-4" />}>
                Voltar
              </Button>

              {campaign.status === 'RUNNING' && (
                <Button
                  variant="ghost"
                  icon={<Pause className="w-4 h-4" />}
                  onClick={() => pause.mutate(id!)}
                  disabled={pause.isPending}
                >
                  Pausar
                </Button>
              )}
              {campaign.status === 'PAUSED' && (
                <Button
                  variant="ghost"
                  icon={<Play className="w-4 h-4" />}
                  onClick={() => resume.mutate(id!)}
                  disabled={resume.isPending}
                >
                  Retomar
                </Button>
              )}

              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-signal">Confirmar exclusão?</span>
                  <Button variant="ghost" className="text-xs" onClick={() => setConfirmDelete(false)}>Não</Button>
                  <Button variant="ghost" className="text-xs" onClick={handleDeleteCampaign} disabled={remove.isPending}>
                    Sim, deletar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  icon={<Trash2 className="w-4 h-4" />}
                  onClick={() => setConfirmDelete(true)}
                  className="text-smoke hover:text-signal"
                >
                  Deletar campanha
                </Button>
              )}
            </div>
          )
        }
      />

      <div className="p-6 md:p-8 space-y-6 max-w-5xl">
        {isLoading && <Skeleton className="h-32" />}

        {campaign && (
          <>
            {/* Métricas */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total', value: campaign.totalCustomers, icon: <Clock className="w-4 h-4 text-smoke" /> },
                { label: 'Enviados', value: campaign.sentCount, icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" /> },
                { label: 'Falhas', value: campaign.failedCount, icon: <XCircle className="w-4 h-4 text-signal" /> },
                { label: 'Ignorados', value: campaign.skippedCount, icon: <AlertTriangle className="w-4 h-4 text-amber-400" /> },
              ].map((m) => (
                <Card key={m.label}>
                  <CardContent className="p-4 flex items-center gap-3">
                    {m.icon}
                    <div>
                      <div className="text-xl font-semibold text-onyx tabular-nums">{m.value}</div>
                      <div className="text-xs text-smoke">{m.label}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Info */}
            <Card>
              <CardContent className="p-5 flex flex-wrap gap-x-8 gap-y-3 text-sm">
                <div>
                  <span className="text-smoke text-xs block mb-0.5">Status</span>
                  <Chip tone={statusTone[campaign.status]} className="text-xs">{statusLabel[campaign.status]}</Chip>
                </div>
                <div>
                  <span className="text-smoke text-xs block mb-0.5">Template</span>
                  <span className="font-medium text-onyx">{campaign.template?.name ?? '—'}</span>
                </div>
                <div>
                  <span className="text-smoke text-xs block mb-0.5">Criado por</span>
                  <span className="text-graphite">{campaign.createdBy?.name ?? '—'}</span>
                </div>
                <div>
                  <span className="text-smoke text-xs block mb-0.5">Criado em</span>
                  <span className="text-graphite">{formatDate(campaign.createdAt)}</span>
                </div>
                {campaign.finishedAt && (
                  <div>
                    <span className="text-smoke text-xs block mb-0.5">Concluído em</span>
                    <span className="text-graphite">{formatDate(campaign.finishedAt)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lista de clientes */}
            <div>
              <h2 className="label-eyebrow text-smoke mb-3">
                Clientes ({campaign.customers?.length ?? 0})
              </h2>

              {!campaign.customers?.length ? (
                <EmptyState title="Nenhum cliente" description="Esta campanha não tem clientes associados." />
              ) : (
                <div className="rounded-sharp border border-platinum-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-platinum-50 border-b border-platinum-100">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-smoke font-medium">Empresa</th>
                        <th className="text-left px-4 py-2.5 text-smoke font-medium">UF</th>
                        <th className="text-left px-4 py-2.5 text-smoke font-medium">WhatsApp</th>
                        <th className="text-left px-4 py-2.5 text-smoke font-medium">Status</th>
                        <th className="text-left px-4 py-2.5 text-smoke font-medium">Enviado em</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-platinum-100/60">
                      {campaign.customers.map((cc) => (
                        <tr key={cc.id} className={cn(
                          'group',
                          cc.status === 'SKIPPED' && 'opacity-50',
                        )}>
                          <td className="px-4 py-3 font-medium text-onyx">
                            {cc.customer.companyName}
                          </td>
                          <td className="px-4 py-3 text-graphite font-mono">
                            {cc.customer.state ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-graphite font-mono">
                            {cc.customer.whatsapp ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5">
                              {ccStatusIcon[cc.status]}
                              <span className={cn(
                                cc.status === 'SENT' && 'text-emerald-600',
                                cc.status === 'FAILED' && 'text-signal',
                              )}>
                                {ccStatusLabel[cc.status]}
                              </span>
                            </span>
                            {cc.failedReason && (
                              <p className="text-2xs text-signal mt-0.5">{cc.failedReason}</p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-smoke tabular-nums">
                            {cc.sentAt ? formatDate(cc.sentAt) : '—'}
                          </td>
                          <td className="px-4 py-3">
                            {canMutate && cc.status === 'PENDING' && (
                              <button
                                onClick={() => handleRemoveCustomer(cc.customer.id)}
                                disabled={removingCustomerId === cc.customer.id}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-signal/10 text-smoke hover:text-signal"
                                title="Remover da campanha"
                              >
                                {removingCustomerId === cc.customer.id
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <UserX className="w-3.5 h-3.5" />
                                }
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
