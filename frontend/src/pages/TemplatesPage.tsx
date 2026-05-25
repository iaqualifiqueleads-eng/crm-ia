import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, FileText, Edit3, Trash2, Power, PowerOff } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import { useTemplates, useDeleteTemplate, useUpdateTemplate } from '@/features/templates/useTemplates';
import { TemplateFormModal } from '@/features/templates/TemplateFormModal';
import { cn, formatDate } from '@/lib/utils';
import type { MessageTemplate, TemplateTrigger } from '@/types/domain';

const triggerLabel: Record<TemplateTrigger, string> = {
  FIRST_CONTACT: 'Primeiro contato',
  REPLENISHMENT_REMINDER: 'Lembrete de reposição',
  REPLENISHMENT_OVERDUE: 'Cliente atrasado',
  RETRY_1H: 'Retry · 1h',
  RETRY_3H: 'Retry · 3h',
  RETRY_24H: 'Retry · 24h',
  CUSTOM: 'Personalizado',
};

const triggerTone: Record<TemplateTrigger, 'champagne' | 'signal' | 'neutral' | 'forest'> = {
  REPLENISHMENT_REMINDER: 'champagne',
  REPLENISHMENT_OVERDUE: 'signal',
  RETRY_1H: 'neutral',
  RETRY_3H: 'neutral',
  RETRY_24H: 'neutral',
  FIRST_CONTACT: 'forest',
  CUSTOM: 'neutral',
};

export function TemplatesPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<MessageTemplate | null>(null);
  const { data, isLoading } = useTemplates({ limit: 50 });
  const remove = useDeleteTemplate();

  return (
    <>
      <PageHeader
        eyebrow="Conteúdo"
        title="Templates de mensagem"
        description="Modelos pré-configurados usados pela IA na cadência automática. Use placeholders entre {{}} para personalizar."
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Novo template
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (data?.data.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum template criado"
            description="Crie templates para que a IA possa disparar mensagens automaticamente quando o cliente estiver perto da reposição."
            icon={<FileText className="h-10 w-10" />}
            action={
              <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
                Criar primeiro template
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data!.data.map((tpl, i) => (
            <TemplateCard
              key={tpl.id}
              template={tpl}
              index={i}
              onEdit={() => setEditTemplate(tpl)}
              onDelete={() => {
                if (confirm(`Remover template "${tpl.name}"?`)) remove.mutate(tpl.id);
              }}
            />
          ))}
        </div>
      )}

      <TemplateFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <TemplateFormModal
        open={!!editTemplate}
        onClose={() => setEditTemplate(null)}
        template={editTemplate}
      />
    </>
  );
}

function TemplateCard({
  template, index, onEdit, onDelete,
}: {
  template: MessageTemplate;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const update = useUpdateTemplate(template.id);
  const toggleActive = () => update.mutate({ isActive: !template.isActive });

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className={cn(
        'bg-pearl border border-platinum-100/70 rounded-sharp p-5',
        'shadow-card hover:shadow-lift transition-shadow duration-200',
        !template.isActive && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <Chip tone={triggerTone[template.trigger]}>{triggerLabel[template.trigger]}</Chip>
            {!template.isActive && <Chip tone="neutral">Inativo</Chip>}
          </div>
          <h3 className="display text-lg text-onyx truncate">{template.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleActive}
            className="p-1.5 text-smoke hover:text-onyx transition-colors"
            title={template.isActive ? 'Desativar' : 'Ativar'}
          >
            {template.isActive ? <Power className="h-3.5 w-3.5" /> : <PowerOff className="h-3.5 w-3.5" />}
          </button>
          <button onClick={onEdit} className="p-1.5 text-smoke hover:text-onyx transition-colors">
            <Edit3 className="h-3.5 w-3.5" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-smoke hover:text-signal transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-onyx/[0.02] border-l-2 border-champagne/40 pl-3 pr-2 py-2 my-3">
        <p className="text-xs text-graphite leading-relaxed line-clamp-3 font-mono">
          {template.body}
        </p>
      </div>

      <div className="flex items-center justify-between text-2xs text-smoke mt-3">
        <span>
          Criado por {template.createdBy?.name ?? '—'}
        </span>
        <span className="font-mono">{formatDate(template.createdAt)}</span>
      </div>
    </motion.div>
  );
}
