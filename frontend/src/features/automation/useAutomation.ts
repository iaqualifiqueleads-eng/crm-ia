import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { ReplenishmentConfig } from '@/types/domain';
import type { ForecastMode } from '@/types';

export interface ScheduledContact {
  id: string;
  companyName: string;
  nextReplenishmentAt: string;
  forecastMode: ForecastMode;
  manualIntervalDays: number | null;
  salesperson: { id: string; name: string } | null;
}

export interface PendingJob {
  id: string;
  queue: string;
  name: string;
  customerId: string | null;
  companyName: string | null;
  retryStep: number | null;
  processAt: string;
}

export interface QueueSummary {
  scheduledContacts: ScheduledContact[];
  pendingJobs: PendingJob[];
}

export function useQueueSummary() {
  return useQuery({
    queryKey: ['automation', 'queue'],
    queryFn: async () => {
      const { data } = await api.get<QueueSummary>('/automation/queue');
      return data;
    },
    refetchInterval: 30_000,
  });
}

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
