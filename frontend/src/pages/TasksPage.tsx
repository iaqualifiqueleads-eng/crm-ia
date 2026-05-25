import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Check, AlertTriangle, Calendar, Phone, Mail, Users, MapPin, Repeat } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Chip, PriorityChip, TaskStatusChip } from '@/components/ui/Chip';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import { useTasks, useCompleteTask } from '@/features/tasks/useTasks';
import { TaskFormModal } from '@/features/tasks/TaskFormModal';
import { cn, formatDateTime, relativeDays } from '@/lib/utils';
import type { Task } from '@/types/domain';
import type { TaskType as TT } from '@/types';

type Scope = 'today' | 'overdue' | 'upcoming';

const tabConfig: Array<{ key: Scope; label: string; tone: 'neutral' | 'signal' | 'champagne' }> = [
  { key: 'today',    label: 'Hoje',      tone: 'champagne' },
  { key: 'overdue',  label: 'Vencidas',  tone: 'signal' },
  { key: 'upcoming', label: 'Próximas',  tone: 'neutral' },
];

const typeIcon: Record<string, React.ElementType> = {
  CALL: Phone, EMAIL: Mail, MEETING: Users, VISIT: MapPin,
  FOLLOW_UP: Repeat, REPLENISHMENT_DUE: Calendar, REPLENISHMENT_OVERDUE: AlertTriangle,
};

export function TasksPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const initialScope = (params.get('scope') as Scope) || 'today';
  const [scope, setScope] = useState<Scope>(initialScope);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useTasks({ scope, limit: 100 });
  const complete = useCompleteTask();

  const handleScope = (s: Scope) => {
    setScope(s);
    setParams((prev) => { prev.set('scope', s); return prev; });
  };

  return (
    <>
      <PageHeader
        eyebrow="Agenda"
        title="Tarefas"
        description="Tarefas criadas manualmente ou geradas automaticamente pela cadência de reposição."
        actions={
          <Button onClick={() => setCreateOpen(true)} icon={<Plus className="h-4 w-4" />}>
            Nova tarefa
          </Button>
        }
      />

      {/* Tabs editoriais */}
      <div className="mb-6 inline-flex border-b border-platinum-100">
        {tabConfig.map((t) => (
          <button
            key={t.key}
            onClick={() => handleScope(t.key)}
            className={cn(
              'relative px-5 py-3 text-sm transition-colors',
              scope === t.key ? 'text-onyx' : 'text-smoke hover:text-graphite',
            )}
          >
            {t.label}
            {scope === t.key && (
              <motion.span
                layoutId="tab-underline"
                className="absolute left-3 right-3 -bottom-px h-px bg-champagne"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (data?.data.length ?? 0) === 0 ? (
        <Card>
          <EmptyState
            title={
              scope === 'today' ? 'Sem tarefas para hoje' :
              scope === 'overdue' ? 'Sem tarefas vencidas' :
              'Sem tarefas futuras'
            }
            description={
              scope === 'today'
                ? 'Bom dia tranquilo. Crie uma tarefa ou aguarde os disparos automáticos.'
                : 'Nada pendente neste recorte.'
            }
            icon={<Check className="h-10 w-10" />}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {data!.data.map((task, i) => (
            <TaskRow
              key={task.id}
              task={task}
              index={i}
              onComplete={() => complete.mutate(task.id)}
              onOpenCustomer={(id) => navigate(`/customers/${id}`)}
            />
          ))}
        </div>
      )}

      <TaskFormModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

// ============== TaskRow ==============

function TaskRow({
  task, index, onComplete, onOpenCustomer,
}: {
  task: Task;
  index: number;
  onComplete: () => void;
  onOpenCustomer: (id: string) => void;
}) {
  const Icon = typeIcon[task.type as TT] ?? Calendar;
  const days = relativeDays(task.dueDate);
  const isOverdue = days !== null && days < 0 && task.status !== 'DONE';
  const isToday = days === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn(
        'group relative bg-pearl border border-platinum-100/70 rounded-sharp p-5',
        'shadow-card hover:shadow-lift transition-all duration-200',
        isOverdue && 'border-signal/30',
      )}
    >
      {/* Acento lateral */}
      {(task.priority === 'URGENT' || isOverdue) && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-signal" />
      )}
      {task.isAutomatic && task.priority !== 'URGENT' && !isOverdue && (
        <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-champagne" />
      )}

      <div className="flex items-start gap-4">
        {/* Checkbox circle */}
        <button
          onClick={onComplete}
          disabled={task.status === 'DONE'}
          className={cn(
            'h-5 w-5 rounded-full border-2 mt-0.5 shrink-0',
            'flex items-center justify-center transition-colors',
            task.status === 'DONE'
              ? 'bg-forest border-forest cursor-default'
              : 'border-platinum-100 hover:border-onyx',
          )}
        >
          {task.status === 'DONE' && <Check className="h-3 w-3 text-pearl" strokeWidth={3} />}
        </button>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-smoke shrink-0" />
                <h3 className={cn(
                  'text-base text-onyx font-medium truncate',
                  task.status === 'DONE' && 'line-through text-smoke',
                )}>
                  {task.title}
                </h3>
                {task.isAutomatic && (
                  <Chip tone="champagne" className="shrink-0">Auto</Chip>
                )}
              </div>
              {task.description && (
                <p className="text-sm text-smoke mt-1 line-clamp-2">{task.description}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <PriorityChip priority={task.priority} />
              <TaskStatusChip status={task.status} />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4 text-xs text-smoke">
            {task.dueDate && (
              <span className={cn(
                'font-mono tabular-nums',
                isOverdue && 'text-signal',
                isToday && task.status !== 'DONE' && 'text-champagne',
              )}>
                <Calendar className="h-3 w-3 inline mr-1" />
                {formatDateTime(task.dueDate)}
                {isOverdue && ` · ${Math.abs(days!)}d atrasada`}
                {isToday && task.status !== 'DONE' && ' · hoje'}
              </span>
            )}
            {task.customer && (
              <button
                onClick={() => onOpenCustomer(task.customer!.id)}
                className="hover:text-onyx hover:underline truncate"
              >
                {task.customer.companyName}
              </button>
            )}
            {task.assignee && (
              <span className="truncate">→ {task.assignee.name}</span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
