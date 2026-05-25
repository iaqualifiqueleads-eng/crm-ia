import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { ReplenishmentConfig } from '@/types/domain';

export function useReplenishmentConfig() {
  return useQuery({
    queryKey: ['automation', 'replenishment'],
    queryFn: async () => {
      const { data } = await api.get<ReplenishmentConfig>('/automation/replenishment');
      return data;
    },
  });
}

export function useUpdateReplenishmentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ReplenishmentConfig>) => {
      const { data } = await api.put<ReplenishmentConfig>('/automation/replenishment', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['automation'] });
      toast.success('Cadência atualizada');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
