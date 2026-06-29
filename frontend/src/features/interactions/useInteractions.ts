import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';
import type { Interaction, Paginated } from '@/types';

export function useCustomerInteractions(customerId: string | null) {
  return useQuery({
    queryKey: ['interactions', customerId],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Interaction>>('/interactions', {
        params: { customerId, limit: 200, page: 1 },
      });
      return data.data;
    },
    enabled: !!customerId,
    refetchInterval: 10_000,
  });
}

export function useContactedCustomers() {
  return useQuery({
    queryKey: ['interactions', 'contacted-customers'],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Interaction>>('/interactions', {
        params: { limit: 200, page: 1 },
      });
      // Agrupa por cliente, pega a última interação WhatsApp de cada um
      const map = new Map<string, { customerId: string; lastInteraction: Interaction }>();
      for (const interaction of data.data) {
        if (!['WHATSAPP', 'WHATSAPP_AI'].includes(interaction.type)) continue;
        const existing = map.get(interaction.customerId);
        if (!existing || new Date(interaction.createdAt) > new Date(existing.lastInteraction.createdAt)) {
          map.set(interaction.customerId, { customerId: interaction.customerId, lastInteraction: interaction });
        }
      }
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.lastInteraction.createdAt).getTime() - new Date(a.lastInteraction.createdAt).getTime(),
      );
    },
    refetchInterval: 15_000,
  });
}
