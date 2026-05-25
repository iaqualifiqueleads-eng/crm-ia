import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'champagne' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<Variant, string> = {
  primary:
    'bg-onyx text-pearl hover:bg-carbon active:bg-onyx-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
  secondary:
    'bg-pearl text-onyx border border-platinum-100 hover:border-onyx hover:bg-platinum-50/40',
  ghost:
    'text-smoke hover:text-onyx hover:bg-platinum/30',
  champagne:
    'bg-champagne text-onyx hover:bg-champagne-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]',
  danger:
    'bg-signal text-pearl hover:bg-signal/90',
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, icon, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-sharp',
          'transition-all duration-200 ease-out select-none',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne',
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';
