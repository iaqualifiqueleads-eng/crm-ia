import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { CustomerStatus } from '@/types';

const config: Array<{ key: CustomerStatus; label: string; color: string }> = [
  { key: 'LEAD',     label: 'Lead',     color: 'bg-graphite' },
  { key: 'PROSPECT', label: 'Prospect', color: 'bg-champagne-100' },
  { key: 'ACTIVE',   label: 'Ativo',    color: 'bg-forest' },
  { key: 'AT_RISK',  label: 'Em Risco', color: 'bg-signal' },
  { key: 'CHURNED',  label: 'Perdido',  color: 'bg-platinum-100' },
];

export function StatusDistribution({ data }: { data: Record<CustomerStatus, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-5">
      {/* barra unificada */}
      <div className="flex h-2 w-full rounded-sharp overflow-hidden bg-platinum-50">
        {config.map((c, i) => {
          const v = data[c.key] ?? 0;
          const pct = (v / total) * 100;
          if (pct === 0) return null;
          return (
            <motion.div
              key={c.key}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className={cn('h-full', c.color)}
            />
          );
        })}
      </div>

      {/* legenda */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        {config.map((c) => {
          const v = data[c.key] ?? 0;
          return (
            <div key={c.key} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2.5 text-graphite">
                <span className={cn('h-1.5 w-1.5 rounded-full', c.color)} />
                {c.label}
              </div>
              <span className="font-mono text-onyx tabular-nums">{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
