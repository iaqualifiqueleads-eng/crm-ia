import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'bg-pearl border border-platinum-100/70 rounded-sharp shadow-card',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'px-6 py-5 border-b border-platinum-100/70 flex items-center justify-between',
        className,
      )}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('display text-xl text-onyx', className)}
      {...props}
    />
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardEyebrow = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('label-eyebrow', className)}
      {...props}
    />
  ),
);
CardEyebrow.displayName = 'CardEyebrow';

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';
