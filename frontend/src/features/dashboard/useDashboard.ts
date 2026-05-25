import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { DashboardSummary, Customer } from '@/types';

export function useDashboardSummary(days = 30) {
  return useQuery({
    queryKey: ['dashboard', 'summary', days],
    queryFn: async () => {
      const { data } = await api.get<DashboardSummary>('/dashboard/summary', {
        params: { days },
      });
      return data;
    },
    refetchInterval: 5 * 60_000,
  });
}

export function useDrillDown(metric: string | null) {
  return useQuery({
    queryKey: ['dashboard', 'drill', metric],
    queryFn: async () => {
      const { data } = await api.get<{ metric: string; total: number; customers: Customer[] }>(
        '/dashboard/drill-down',
        { params: { metric } },
      );
      return data;
    },
    enabled: !!metric,
  });
}
