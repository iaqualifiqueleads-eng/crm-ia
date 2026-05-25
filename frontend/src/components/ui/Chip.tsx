import { cn } from '@/lib/utils';
import type { CustomerStatus, TaskPriority, TaskStatus, UserRole } from '@/types';

interface ChipProps {
  children: React.ReactNode;
  tone?: 'neutral' | 'champagne' | 'signal' | 'forest' | 'onyx';
  className?: string;
}

const toneStyles: Record<NonNullable<ChipProps['tone']>, string> = {
  neutral:   'bg-platinum-50/70 text-graphite border-platinum-100/80',
  champagne: 'bg-champagne/15 text-champagne-100 border-champagne/30',
  signal:    'bg-signal/10 text-signal border-signal/25',
  forest:    'bg-forest/10 text-forest border-forest/25',
  onyx:      'bg-onyx text-pearl border-onyx',
};

export function Chip({ children, tone = 'neutral', className }: ChipProps) {
  return (
    <span className={cn('chip', toneStyles[tone], className)}>{children}</span>
  );
}

// ===== Mapeamentos específicos =====

const customerStatusMap: Record<CustomerStatus, { label: string; tone: ChipProps['tone'] }> = {
  LEAD:     { label: 'Lead',      tone: 'neutral' },
  PROSPECT: { label: 'Prospect',  tone: 'champagne' },
  ACTIVE:   { label: 'Ativo',     tone: 'forest' },
  AT_RISK:  { label: 'Em Risco',  tone: 'signal' },
  CHURNED:  { label: 'Perdido',   tone: 'neutral' },
};

export function CustomerStatusChip({ status }: { status: CustomerStatus }) {
  const cfg = customerStatusMap[status];
  return <Chip tone={cfg.tone}>{cfg.label}</Chip>;
}

const priorityMap: Record<TaskPriority, { label: string; tone: ChipProps['tone'] }> = {
  LOW:    { label: 'Baixa',   tone: 'neutral' },
  MEDIUM: { label: 'Média',   tone: 'neutral' },
  HIGH:   { label: 'Alta',    tone: 'champagne' },
  URGENT: { label: 'Urgente', tone: 'signal' },
};
export function PriorityChip({ priority }: { priority: TaskPriority }) {
  const cfg = priorityMap[priority];
  return <Chip tone={cfg.tone}>{cfg.label}</Chip>;
}

const taskStatusMap: Record<TaskStatus, { label: string; tone: ChipProps['tone'] }> = {
  PENDING:     { label: 'Pendente',    tone: 'neutral' },
  IN_PROGRESS: { label: 'Em andamento', tone: 'champagne' },
  DONE:        { label: 'Concluída',   tone: 'forest' },
  CANCELED:    { label: 'Cancelada',   tone: 'neutral' },
};
export function TaskStatusChip({ status }: { status: TaskStatus }) {
  const cfg = taskStatusMap[status];
  return <Chip tone={cfg.tone}>{cfg.label}</Chip>;
}

const roleMap: Record<UserRole, string> = {
  MANAGER: 'Gerente',
  SUPERVISOR: 'Supervisor',
  SALESPERSON: 'Vendedor',
};
export function RoleChip({ role }: { role: UserRole }) {
  return <Chip tone={role === 'MANAGER' ? 'onyx' : role === 'SUPERVISOR' ? 'champagne' : 'neutral'}>{roleMap[role]}</Chip>;
}
