import { cn } from '@/lib/utils';

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {icon && <div className="mb-4 text-smoke/60">{icon}</div>}
      <h3 className="display text-xl text-onyx">{title}</h3>
      {description && <p className="mt-2 text-sm text-smoke max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-sharp bg-gradient-to-r from-platinum-50 via-platinum/80 to-platinum-50',
        'bg-[length:200%_100%] animate-shimmer',
        className,
      )}
    />
  );
}

export function LoadingRow({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
