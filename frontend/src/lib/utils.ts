import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string, currency = 'BRL') {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency }).format(
    Number.isFinite(n) ? n : 0,
  );
}

export function formatNumber(value: number | string, fractionDigits = 0) {
  const n = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number.isFinite(n) ? n : 0);
}

export function formatDate(date: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', opts ?? { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return '—';
  return formatDate(date, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function relativeDays(target: string | Date | null | undefined): number | null {
  if (!target) return null;
  const t = typeof target === 'string' ? new Date(target) : target;
  if (Number.isNaN(t.getTime())) return null;
  const diff = Math.floor((t.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function getInitials(name?: string | null) {
  if (!name) return '·';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
