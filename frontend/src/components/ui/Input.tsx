import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('label-eyebrow block mb-1.5', className)}
      {...props}
    />
  ),
);
Label.displayName = 'Label';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'w-full h-11 bg-pearl border border-platinum-100 rounded-sharp',
            'px-3.5 text-sm text-onyx placeholder:text-smoke/60',
            'focus:border-onyx focus:outline-none transition-colors duration-150',
            error && 'border-signal focus:border-signal',
            className,
          )}
          {...props}
        />
        {error && <p className="mt-1.5 text-xs text-signal">{error}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full h-11 bg-pearl border border-platinum-100 rounded-sharp',
        'px-3 pr-8 text-sm text-onyx',
        'focus:border-onyx focus:outline-none transition-colors duration-150',
        'appearance-none bg-[length:14px] bg-[right_12px_center] bg-no-repeat cursor-pointer',
        className,
      )}
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236C6C72' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
      }}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full bg-pearl border border-platinum-100 rounded-sharp',
        'px-3.5 py-2.5 text-sm text-onyx placeholder:text-smoke/60',
        'focus:border-onyx focus:outline-none transition-colors duration-150',
        'min-h-[88px] resize-y',
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = 'Textarea';
