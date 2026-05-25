import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header className={cn('flex items-end justify-between gap-6 mb-10', className)}>
      <div className="min-w-0">
        {eyebrow && <div className="label-eyebrow mb-3">{eyebrow}</div>}
        <h1 className="display text-4xl text-onyx leading-none">{title}</h1>
        {description && (
          <p className="mt-3 text-sm text-smoke max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </header>
  );
}
