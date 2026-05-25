import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  eyebrow: string;
  value: string;
  caption?: string;
  trend?: { value: string; positive?: boolean };
  accent?: 'champagne' | 'signal' | 'forest' | 'neutral';
  onClick?: () => void;
  delay?: number;
}

const accentMap = {
  champagne: 'text-champagne',
  signal:    'text-signal',
  forest:    'text-forest',
  neutral:   'text-smoke',
};

export function MetricCard({ eyebrow, value, caption, trend, accent = 'neutral', onClick, delay = 0 }: MetricCardProps) {
  const clickable = !!onClick;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={clickable ? { y: -2 } : undefined}
      className={cn(
        'group relative w-full text-left',
        'bg-pearl border border-platinum-100/70 rounded-sharp p-6',
        'shadow-card transition-shadow duration-200',
        clickable ? 'hover:shadow-lift cursor-pointer' : 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('label-eyebrow', accentMap[accent])}>{eyebrow}</div>
        {clickable && (
          <ArrowUpRight className="h-3.5 w-3.5 text-smoke/40 group-hover:text-onyx transition-colors" />
        )}
      </div>

      <div className="mt-5 flex items-baseline gap-3">
        <span className="display text-5xl text-onyx leading-none">{value}</span>
        {trend && (
          <span className={cn(
            'text-2xs uppercase tracking-micro font-mono',
            trend.positive ? 'text-forest' : 'text-signal',
          )}>
            {trend.positive ? '↑' : '↓'} {trend.value}
          </span>
        )}
      </div>

      {caption && (
        <div className="mt-4 pt-4 border-t border-platinum-100/70 text-xs text-smoke">
          {caption}
        </div>
      )}

      {/* linha dourada inferior decorativa quando hover */}
      {clickable && (
        <span className="absolute left-0 bottom-0 h-px w-0 bg-champagne transition-all duration-300 group-hover:w-full" />
      )}
    </motion.button>
  );
}
