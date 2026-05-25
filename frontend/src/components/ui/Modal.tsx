import { type ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="absolute inset-0 bg-onyx/40 backdrop-blur-[2px]"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className={cn(
              'relative w-full bg-pearl border border-platinum-100 rounded-sharp shadow-lift',
              'overflow-hidden',
              sizes[size],
            )}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-smoke hover:text-onyx p-1 rounded-sharp"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>

            {(title || eyebrow) && (
              <div className="px-7 pt-7 pb-5 border-b border-platinum-100/70">
                {eyebrow && <div className="label-eyebrow mb-2">{eyebrow}</div>}
                {title && <h2 className="display text-2xl text-onyx">{title}</h2>}
              </div>
            )}

            <div className="px-7 py-6 max-h-[70vh] overflow-y-auto">{children}</div>

            {footer && (
              <div className="px-7 py-4 border-t border-platinum-100/70 bg-platinum-50/30 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
