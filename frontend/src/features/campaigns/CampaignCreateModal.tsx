import { useState } from 'react';
import { Search, CheckCircle2, XCircle, Loader2, AlertTriangle, Megaphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { useCampaignPreview, useCreateCampaign } from './useCampaigns';
import { useTemplates } from '@/features/templates/useTemplates';
import { formatDate, cn } from '@/lib/utils';
import type { CampaignPreviewCustomer } from '@/types/domain';

const BRAZIL_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA',
  'MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN',
  'RS','RO','RR','SC','SP','SE','TO',
];

type Step = 'filters' | 'preview' | 'confirming' | 'done';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CampaignCreateModal({ open, onClose }: Props) {
  const [step, setStep] = useState<Step>('filters');
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [lastInteractionBefore, setLastInteractionBefore] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [preview, setPreview] = useState<{ total: number; withWhatsapp: number; customers: CampaignPreviewCustomer[] } | null>(null);

  const previewMutation = useCampaignPreview();
  const createMutation = useCreateCampaign();
  const { data: templates } = useTemplates({ isActive: true, limit: 100 });

  const reset = () => {
    setStep('filters');
    setName('');
    setState('');
    setLastInteractionBefore('');
    setTemplateId('');
    setPreview(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const handlePreview = async () => {
    const result = await previewMutation.mutateAsync({
      state: state || undefined,
      lastInteractionBefore: lastInteractionBefore || undefined,
    });
    setPreview(result);
    setStep('preview');
  };

  const handleCreate = async () => {
    setStep('confirming');
    await createMutation.mutateAsync({
      name,
      templateId,
      state: state || undefined,
      lastInteractionBefore: lastInteractionBefore || undefined,
    });
    setStep('done');
  };

  const canPreview = state || lastInteractionBefore;
  const canCreate = name.trim().length >= 3 && templateId && preview && preview.withWhatsapp > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      eyebrow="Campanhas"
      title="Nova campanha"
      size="xl"
      footer={
        step === 'filters' ? (
          <>
            <Button variant="ghost" onClick={handleClose} type="button">Cancelar</Button>
            <Button
              onClick={handlePreview}
              disabled={!canPreview || previewMutation.isPending}
              icon={previewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            >
              {previewMutation.isPending ? 'Buscando…' : 'Ver clientes elegíveis'}
            </Button>
          </>
        ) : step === 'preview' ? (
          <>
            <Button variant="ghost" onClick={() => setStep('filters')} type="button">Voltar</Button>
            <Button
              onClick={handleCreate}
              disabled={!canCreate}
              icon={<Megaphone className="w-4 h-4" />}
            >
              Criar campanha
            </Button>
          </>
        ) : step === 'done' ? (
          <Button onClick={handleClose}>Fechar</Button>
        ) : null
      }
    >
      {/* ── FILTROS ── */}
      {step === 'filters' && (
        <div className="space-y-5">
          <p className="text-sm text-graphite">
            Defina o segmento que receberá a campanha. Ao menos um filtro é obrigatório.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Estado (UF)</Label>
              <Select value={state} onChange={(e) => setState(e.target.value)}>
                <option value="">Todos os estados</option>
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label>Última interação antes de</Label>
              <Input
                type="date"
                value={lastInteractionBefore}
                onChange={(e) => setLastInteractionBefore(e.target.value)}
              />
              <p className="text-2xs text-smoke mt-1">
                Inclui clientes sem nenhuma interação registrada.
              </p>
            </div>
          </div>

          {!canPreview && (
            <p className="text-xs text-amber-600 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Selecione ao menos um filtro para continuar.
            </p>
          )}
        </div>
      )}

      {/* ── PREVIEW + CONFIG ── */}
      {step === 'preview' && preview && (
        <div className="space-y-5">
          {/* Resumo */}
          <div className="flex items-center gap-6 p-4 bg-platinum-50/60 rounded-sharp border border-platinum-100">
            <div className="text-center">
              <div className="text-2xl font-semibold text-onyx tabular-nums">{preview.total}</div>
              <div className="text-xs text-smoke mt-0.5">clientes encontrados</div>
            </div>
            <div className="h-8 w-px bg-platinum-100" />
            <div className="text-center">
              <div className="text-2xl font-semibold text-emerald-600 tabular-nums">{preview.withWhatsapp}</div>
              <div className="text-xs text-smoke mt-0.5">com WhatsApp</div>
            </div>
            <div className="h-8 w-px bg-platinum-100" />
            <div className="text-center">
              <div className="text-2xl font-semibold text-smoke tabular-nums">{preview.total - preview.withWhatsapp}</div>
              <div className="text-xs text-smoke mt-0.5">serão ignorados</div>
            </div>
          </div>

          {preview.withWhatsapp === 0 && (
            <p className="text-sm text-signal flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              Nenhum cliente do segmento tem WhatsApp cadastrado. Ajuste os filtros.
            </p>
          )}

          {/* Nome e template — obrigatórios antes de confirmar */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nome da campanha *</Label>
              <Input
                placeholder="Ex: Reengajamento ES — Julho"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={150}
              />
            </div>

            <div>
              <Label>Template da mensagem *</Label>
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Selecione um template</option>
                {templates?.data.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
          </div>

          {/* Lista de clientes */}
          <div>
            <p className="text-xs text-smoke mb-2">
              Clientes que receberão a mensagem (somente os que têm WhatsApp):
            </p>
            <div className="max-h-[300px] overflow-y-auto rounded-sharp border border-platinum-100">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-platinum-50 border-b border-platinum-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-smoke font-medium">Empresa</th>
                    <th className="text-left px-3 py-2 text-smoke font-medium">UF</th>
                    <th className="text-left px-3 py-2 text-smoke font-medium">Vendedor</th>
                    <th className="text-left px-3 py-2 text-smoke font-medium">Última interação</th>
                    <th className="text-left px-3 py-2 text-smoke font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-platinum-100/60">
                  {preview.customers.map((c) => (
                    <tr key={c.id} className={cn(!c.whatsapp && 'opacity-40')}>
                      <td className="px-3 py-2 font-medium text-onyx">
                        {c.companyName}
                        {!c.whatsapp && <span className="ml-2 text-smoke font-normal">(sem WhatsApp)</span>}
                      </td>
                      <td className="px-3 py-2 text-graphite font-mono">{c.state ?? '—'}</td>
                      <td className="px-3 py-2 text-graphite">{c.salesperson?.name ?? '—'}</td>
                      <td className="px-3 py-2 text-smoke">
                        {c.lastInteractionAt ? formatDate(c.lastInteractionAt) : 'Nunca'}
                      </td>
                      <td className="px-3 py-2">
                        <Chip tone="neutral">{c.status}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-xs text-smoke flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            Os disparos serão espaçados 10 minutos entre cada cliente, respeitando o horário comercial.
          </p>
        </div>
      )}

      {/* ── CONFIRMANDO ── */}
      {step === 'confirming' && (
        <div className="flex flex-col items-center gap-4 py-10">
          <Loader2 className="w-8 h-8 text-onyx animate-spin" />
          <p className="text-sm text-graphite">Criando campanha e enfileirando disparos…</p>
        </div>
      )}

      {/* ── DONE ── */}
      {step === 'done' && (
        <div className="flex flex-col items-center gap-4 py-10">
          <CheckCircle2 className="w-10 h-10 text-emerald-500" />
          <div className="text-center">
            <p className="text-sm font-medium text-onyx">Campanha criada com sucesso</p>
            <p className="text-xs text-smoke mt-1">
              Os disparos estão sendo processados com intervalo de 10 minutos entre cada cliente.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
