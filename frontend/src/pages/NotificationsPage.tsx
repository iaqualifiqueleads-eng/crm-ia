import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bell, BellOff, Check, AlertTriangle, AlertCircle, CheckCheck, Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState, Skeleton } from '@/components/ui/EmptyState';
import { useNotifications, useMarkAllRead, useMarkRead } from '@/features/notifications/useNotifications';
import { cn, formatDateTime } from '@/lib/utils';
import type { Notification, NotificationSeverity } from '@/types/domain';

const severityIcon: Record<NotificationSeverity, React.ElementType> = {
  INFO: Info,
  WARNING: AlertTriangle,
  CRITICAL: AlertCircle,
};

const severityTone: Record<NotificationSeverity, string> = {
  INFO:     'text-graphite',
  WARNING:  'text-champagne-100',
  CRITICAL: 'text-signal',
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const { data, isLoading } = useNotifications(unreadOnly);
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();

  const items = data?.data ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Inbox"
        title="Notificações"
        description={
          (data?.unreadCount ?? 0) > 0
            ? `${data!.unreadCount} não lidas`
            : 'Tudo em dia.'
        }
        actions={
          <>
            <Button
              variant={unreadOnly ? 'primary' : 'secondary'}
              size="md"
              onClick={() => setUnreadOnly((v) => !v)}
              icon={unreadOnly ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
            >
              {unreadOnly ? 'Mostrar todas' : 'Somente não lidas'}
            </Button>
            {(data?.unreadCount ?? 0) > 0 && (
              <Button
                variant="ghost"
                onClick={() => markAll.mutate()}
                icon={<CheckCheck className="h-4 w-4" />}
              >
                Marcar tudo como lido
              </Button>
            )}
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            title={unreadOnly ? 'Nenhuma notificação não lida' : 'Caixa vazia'}
            description="Sistema, equipe e automação reportam aqui."
            icon={<Bell className="h-10 w-10" />}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-platinum-100/60">
            {items.map((n, i) => (
              <NotificationRow
                key={n.id}
                notification={n}
                index={i}
                onClick={() => {
                  if (!n.readAt) markOne.mutate(n.id);
                  if (n.linkUrl) navigate(n.linkUrl);
                }}
              />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function NotificationRow({
  notification: n, index, onClick,
}: { notification: Notification; index: number; onClick: () => void }) {
  const Icon = severityIcon[n.severity];
  const unread = !n.readAt;

  return (
    <motion.li
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
    >
      <button
        onClick={onClick}
        className={cn(
          'group w-full px-5 py-4 flex items-start gap-4 text-left transition-colors',
          'hover:bg-platinum-50/50',
          unread && 'bg-champagne/[0.04]',
        )}
      >
        {unread && (
          <span className="h-1.5 w-1.5 rounded-full bg-champagne mt-2 shrink-0" />
        )}
        {!unread && (
          <span className="h-1.5 w-1.5 mt-2 shrink-0" />
        )}

        <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', severityTone[n.severity])} />

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <h4 className={cn(
              'text-sm truncate',
              unread ? 'text-onyx font-medium' : 'text-graphite',
            )}>
              {n.title}
            </h4>
            <time className="text-2xs text-smoke font-mono shrink-0">
              {formatDateTime(n.createdAt)}
            </time>
          </div>
          <p className="text-xs text-smoke mt-1 line-clamp-2">
            {/* Remove a tag [ref:...] visual */}
            {n.message.replace(/\s*\[ref:[^\]]+\]/g, '')}
          </p>
        </div>
      </button>
    </motion.li>
  );
}
