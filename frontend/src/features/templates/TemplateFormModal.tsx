import { useEffect, useState, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { useCreateTemplate, useUpdateTemplate, type UpsertTemplateInput } from '@/features/templates/useTemplates';
import type { MessageTemplate, TemplateTrigger } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  template?: MessageTemplate | null;
}

const triggers: Array<{ value: TemplateTrigger; label: string; description: string }> = [
  { value: 'REPLENISHMENT_REMINDER', label: 'Lembrete de reposição', description: 'Disparado no dia previsto da próxima compra' },
  { value: 'RETRY_1H',  label: 'Retry 1h',  description: 'Se cliente não respondeu em 1h' },
  { value: 'RETRY_3H',  label: 'Retry 3h',  description: 'Se cliente não respondeu em 3h' },
  { value: 'RETRY_24H', label: 'Retry 24h', description: 'Última tentativa antes de escalar' },
  { value: 'REPLENISHMENT_OVERDUE', label: 'Cliente atrasado', description: 'Cliente passou do prazo previsto' },
  { value: 'FIRST_CONTACT', label: 'Primeiro contato', description: 'Mensagem inicial após cadastro' },
  { value: 'CUSTOM',  label: 'Personalizado', description: 'Disparo manual ou cenário customizado' },
];

const placeholderTokens = [
  { token: 'contactName',         desc: 'Nome do contato principal' },
  { token: 'companyName',         desc: 'Razão social' },
  { token: 'daysOverdue',         desc: 'Dias em atraso' },
  { token: 'lastOrderAt',         desc: 'Data da última compra' },
  { token: 'nextReplenishmentAt', desc: 'Data prevista da próxima compra' },
  { token: 'salespersonName',     desc: 'Nome do vendedor responsável' },
];

const empty: UpsertTemplateInput = {
  name: '', trigger: 'REPLENISHMENT_REMINDER', body: '',
  channel: 'whatsapp', isActive: true,
};

export function TemplateFormModal({ open, onClose, template }: Props) {
  const isEdit = !!template;
  const create = useCreateTemplate();
  const update = useUpdateTemplate(template?.id ?? '');

  const [form, setForm] = useState<UpsertTemplateInput>(empty);

  useEffect(() => {
    if (!open) return;
    setForm(template ? {
      name: template.name,
      trigger: template.trigger,
      body: template.body,
      aiInstructions: template.aiInstructions ?? '',
      channel: template.channel,
      isActive: template.isActive,
    } : empty);
  }, [open, template]);

  const set = <K extends keyof UpsertTemplateInput>(k: K, v: UpsertTemplateInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // preview renderizado com vars fictícias
  const preview = useMemo(() => {
    const vars: Record<string, string> = {
      contactName: 'Júlia Mendes',
      companyName: 'Construtora Alpha',
      daysOverdue: '5',
      lastOrderAt: '15/04/2026',
      nextReplenishmentAt: '15/05/2026',
      salespersonName: 'Ariany',
    };
    return form.body.replace(/\{\{\s*([\w_.]+)\s*\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`);
  }, [form.body]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.body.trim()) return;
    try {
      if (isEdit) await update.mutateAsync(form);
      else await create.mutateAsync(form);
      onClose();
    } catch { /* tratado */ }
  };

  const insertPlaceholder = (token: string) => {
    set('body', `${form.body}{{${token}}}`);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? 'Editar template' : 'Novo template'}
      title={isEdit ? template!.name : 'Criar template de mensagem'}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={onSubmit as any} loading={create.isPending || update.isPending}>
            {isEdit ? 'Salvar' : 'Criar template'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Editor */}
        <div className="lg:col-span-3 space-y-5">
          <div>
            <Label>Nome interno *</Label>
            <Input
              required
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Lembrete padrão de reposição"
            />
          </div>

          <div>
            <Label>Gatilho *</Label>
            <Select
              value={form.trigger}
              onChange={(e) => set('trigger', e.target.value as TemplateTrigger)}
            >
              {triggers.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
            <p className="text-2xs text-smoke mt-1.5">
              {triggers.find((t) => t.value === form.trigger)?.description}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="!mb-0">Corpo da mensagem *</Label>
              <span className="text-2xs text-smoke">{form.body.length} caracteres</span>
            </div>
            <Textarea
              required
              rows={6}
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder="Olá {{contactName}}, tudo bem? Vi que faz alguns dias desde sua última compra na {{companyName}}..."
              className="font-mono text-xs leading-relaxed"
            />
            {/* placeholder chips */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {placeholderTokens.map((p) => (
                <button
                  key={p.token}
                  type="button"
                  onClick={() => insertPlaceholder(p.token)}
                  className="text-2xs uppercase tracking-micro px-2 py-1 bg-platinum-50 hover:bg-onyx hover:text-pearl text-graphite border border-platinum-100 rounded-sharp transition-colors"
                  title={p.desc}
                >
                  {`{{${p.token}}}`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>Instruções para a IA (opcional)</Label>
            <Textarea
              value={form.aiInstructions ?? ''}
              onChange={(e) => set('aiInstructions', e.target.value)}
              placeholder="Tom profissional, cordial e direto. Sem emojis em excesso."
            />
            <p className="text-2xs text-smoke mt-1.5">
              A IA usa estas instruções para refinar o tom antes do envio.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive ?? true}
              onChange={(e) => set('isActive', e.target.checked)}
              className="h-4 w-4 rounded-sharp accent-onyx"
            />
            <label htmlFor="isActive" className="text-sm text-graphite">
              Template ativo (disponível para uso na automação)
            </label>
          </div>
        </div>

        {/* Preview editorial */}
        <div className="lg:col-span-2">
          <div className="label-eyebrow mb-3">Preview · WhatsApp</div>
          <div className="bg-onyx p-5 rounded-sharp min-h-[280px] flex flex-col">
            <div className="text-2xs uppercase tracking-micro text-platinum-100/40 mb-3">
              Como o cliente verá
            </div>
            <div className="bg-pearl/[0.04] border border-pearl/10 p-4 rounded-sharp flex-1">
              <p className="text-pearl text-sm leading-relaxed whitespace-pre-wrap">
                {preview || (
                  <span className="text-platinum-100/30 italic">
                    A mensagem aparece aqui conforme você digita...
                  </span>
                )}
              </p>
            </div>
            <div className="text-2xs text-platinum-100/40 mt-3">
              <span className="text-champagne">↳</span> valores reais substituídos no envio
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
}
