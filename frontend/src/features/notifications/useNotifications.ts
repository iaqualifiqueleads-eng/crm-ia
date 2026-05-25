import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Paginated } from '@/types';
import type { Notification } from '@/types/domain';

export function useNotifications(unreadOnly?: boolean) {
  return useQuery({
    queryKey: ['notifications', { unreadOnly }],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Notification> & { unreadCount: number }>(
        '/notifications',
        { params: { unreadOnly, limit: 50 } },
      );
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<Notification>(`/notifications/${id}/read`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/notifications/mark-all-read');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('Todas marcadas como lidas');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
