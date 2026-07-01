import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Campaign, CampaignPreview } from '@/types/domain';

export interface CampaignFilters {
  state?: string;
  lastInteractionBefore?: string;
}

export interface CreateCampaignInput extends CampaignFilters {
  name: string;
  templateId: string;
}

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data } = await api.get<Campaign[]>('/campaigns');
      return data;
    },
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: ['campaigns', id],
    queryFn: async () => {
      const { data } = await api.get<Campaign>(`/campaigns/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCampaignPreview() {
  return useMutation({
    mutationFn: async (filters: CampaignFilters) => {
      const { data } = await api.post<CampaignPreview>('/campaigns/preview', filters);
      return data;
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const { data } = await api.post<Campaign>('/campaigns', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha criada e disparos enfileirados');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function usePauseCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<Campaign>(`/campaigns/${id}/pause`);
      return data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaigns', id] });
      toast.success('Campanha pausada');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useResumeCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch<Campaign>(`/campaigns/${id}/resume`);
      return data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      qc.invalidateQueries({ queryKey: ['campaigns', id] });
      toast.success('Campanha retomada');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useDeleteCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/campaigns/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campanha deletada');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useRemoveCampaignCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ campaignId, customerId }: { campaignId: string; customerId: string }) => {
      await api.delete(`/campaigns/${campaignId}/customers/${customerId}`);
    },
    onSuccess: (_, { campaignId }) => {
      qc.invalidateQueries({ queryKey: ['campaigns', campaignId] });
      toast.success('Cliente removido da campanha');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
