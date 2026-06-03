import { useEffect, useMemo, useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import {
  useAgentCatalog, useCreateAgent, useUpdateAgent,
  type UpsertAgentInput,
} from './useAgents';
import { providerLabel, toolNameToLabel } from './agent-helpers';
import { cn } from '@/lib/utils';
import type { Agent, AiProvider } from '@/types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  agent?: Agent | null;
}

const empty: UpsertAgentInput = {
  name: '',
  provider: 'CLAUDE',
  model: 'claude-sonnet-4-6',
  systemPrompt: '',
  temperature: 0.7,
  maxTokens: 1024,
  enabledTools: ['transfer_to_human'],
  isActive: true,
  isDefault: false,
};

export function AgentFormModal({ open, onClose, agent }: Props) {
  const isEdit = !!agent;
  const { data: catalog } = useAgentCatalog();
  const create = useCreateAgent();
  const update = useUpdateAgent(agent?.id ?? '');

  const [form, setForm] = useState<UpsertAgentInput>(empty);

  useEffect(() => {
    if (!open) return;
    setForm(agent ? {
      name: agent.name,
      description: agent.description ?? '',
      provider: agent.provider,
      model: agent.model,
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      enabledTools: agent.enabledTools
        ? agent.enabledTools.split(',').map((s) => s.trim()).filter(Boolean)
        : [],
      isActive: agent.isActive,
      isDefault: agent.isDefault,
    } : empty);
  }, [open, agent]);

  const set = <K extends keyof UpsertAgentInput>(k: K, v: UpsertAgentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // Quando o usuário muda o provider, escolhe automaticamente o primeiro modelo
  const setProvider = (p: AiProvider) => {
    const firstModel = catalog?.models[p]?.[0]?.id ?? '';
    setForm((f) => ({ ...f, provider: p, model: firstModel }));
  };

  const toggleTool = (name: string) => {
    setForm((f) => {
      const current = f.enabledTools ?? [];
      const next = current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name];
      return { ...f, enabledTools: next };
    });
  };

  const availableModels = catalog?.models[form.provider] ?? [];
  const pricing = catalog?.pricing[form.model];

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.systemPrompt.trim() || !form.model) return;
    try {
      if (isEdit) await update.mutateAsync(form);
      else await create.mutateAsync(form);
      onClose();
    } catch { /* tratado */ }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={isEdit ? 'Editar agente' : 'Novo agente'}
      title={isEdit ? agent!.name : 'Configurar agente de IA'}
      size="xl"
      footer={
        <>
          <div className="mr-auto text-2xs text-smoke">
            {pricing && (
              <>
                <span className="font-mono">
                  ${pricing.input.toFixed(2)}/{pricing.output.toFixed(2)}
                </span>{' '}
                USD por 1M tokens (entrada/saída)
              </>
            )}
          </div>
          <Button variant="ghost" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={onSubmit as any} loading={create.isPending || update.isPending}>
            {isEdit ? 'Salvar' : 'Criar agente'}
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-6">
        {/* IDENTIDADE */}
        <section>
          <div className="label-eyebrow mb-3">Identidade</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Ex: Vendedor Padrão"
              />
            </div>
            <div className="flex items-end gap-3 pb-2">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive ?? true}
                  onChange={(e) => set('isActive', e.target.checked)}
                  className="h-4 w-4 accent-onyx"
                />
                <span className="text-sm text-graphite">Ativo</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault ?? false}
                  onChange={(e) => set('isDefault', e.target.checked)}
                  className="h-4 w-4 accent-champagne"
                />
                <span className="text-sm text-graphite">Default do workspace</span>
              </label>
            </div>
          </div>
          <div className="mt-4">
            <Label>Descrição</Label>
            <Input
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Para que serve esse agente?"
            />
          </div>
        </section>

        {/* MOTOR */}
        <section>
          <div className="label-eyebrow mb-3">Motor de IA</div>

          {/* Provider switcher tipo "segmented control" */}
          <div className="flex gap-2 mb-4">
            {(['CLAUDE', 'OPENAI', 'GEMINI'] as AiProvider[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={cn(
                  'flex-1 px-4 py-3 border rounded-sharp text-left transition-all',
                  form.provider === p
                    ? 'border-onyx bg-onyx text-pearl'
                    : 'border-platinum-100 hover:border-graphite text-graphite',
                )}
              >
                <div className="text-xs uppercase tracking-micro opacity-70">{providerLabel[p]}</div>
                <div className="text-sm font-medium mt-0.5">
                  {p === 'CLAUDE' ? 'Claude' : p === 'OPENAI' ? 'GPT' : 'Gemini'}
                </div>
              </button>
            ))}
          </div>

          {/* Modelo + temperature + maxTokens */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <Label>Modelo *</Label>
              <Select value={form.model} onChange={(e) => set('model', e.target.value)}>
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}{m.recommended ? ' ★' : ''}
                  </option>
                ))}
              </Select>
              {(() => {
                const meta = availableModels.find((m) => m.id === form.model);
                return meta ? (
                  <p className="text-2xs text-smoke mt-1.5">{meta.description}</p>
                ) : null;
              })()}
            </div>
            <div>
              <Label>Temperatura</Label>
              <Input
                type="number" min={0} max={2} step="0.1"
                value={form.temperature ?? 0.7}
                onChange={(e) => set('temperature', Number(e.target.value))}
              />
              <p className="text-2xs text-smoke mt-1.5">
                0 = determinístico · 1 = criativo · 2 = aleatório
              </p>
            </div>
            <div>
              <Label>Tokens máximos por resposta</Label>
              <Input
                type="number" min={128} max={8192} step={64}
                value={form.maxTokens ?? 1024}
                onChange={(e) => set('maxTokens', Number(e.target.value))}
              />
              <p className="text-2xs text-smoke mt-1.5">
                Limite de saída de cada chamada.
              </p>
            </div>
          </div>
        </section>

        {/* SYSTEM PROMPT */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div className="label-eyebrow">Personalidade & Regras</div>
            <span className="text-2xs text-smoke">{form.systemPrompt.length} caracteres</span>
          </div>
          <Textarea
            required
            rows={10}
            value={form.systemPrompt}
            onChange={(e) => set('systemPrompt', e.target.value)}
            placeholder="Defina a persona, regras, o que pode/não pode fazer, exemplos de tom..."
            className="font-mono text-xs leading-relaxed"
          />
          <p className="text-2xs text-smoke mt-1.5">
            Esse texto vai como <span className="font-mono">system prompt</span> em toda chamada. O contexto do cliente (nome, status, atraso) é anexado automaticamente.
          </p>
        </section>

        {/* TOOLS */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <div className="label-eyebrow">Tools habilitadas</div>
            <span className="text-2xs text-smoke">
              {form.enabledTools?.length ?? 0} de {catalog?.tools.length ?? 0}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {catalog?.tools.map((tool) => {
              const enabled = form.enabledTools?.includes(tool.name) ?? false;
              return (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => toggleTool(tool.name)}
                  className={cn(
                    'group flex items-start gap-3 p-3 border rounded-sharp text-left transition-all',
                    enabled
                      ? 'border-champagne bg-champagne/[0.06]'
                      : 'border-platinum-100 hover:border-graphite/40',
                  )}
                >
                  <span className={cn(
                    'h-4 w-4 rounded-sharp border-2 shrink-0 mt-0.5 flex items-center justify-center',
                    enabled ? 'border-champagne bg-champagne' : 'border-platinum-100',
                  )}>
                    {enabled && <Check className="h-2.5 w-2.5 text-onyx" strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-onyx">
                      {toolNameToLabel(tool.name)}
                    </div>
                    <div className="text-2xs text-smoke font-mono mt-0.5">{tool.name}</div>
                    <p className="text-xs text-graphite/80 mt-1 line-clamp-2">{tool.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-2xs text-smoke mt-3 leading-relaxed">
            Tools dão ao agente poder de <strong className="text-graphite">agir no CRM</strong> (registrar pedidos, agendar tarefas, transferir conversas...). Habilite só o necessário — quanto menos tools, mais previsível o comportamento.
          </p>
        </section>
      </form>
    </Modal>
  );
}
