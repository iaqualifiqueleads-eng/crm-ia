import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Paginated } from '@/types';
import type {
  Agent, AgentCatalog, AgentUsageStats, AiProvider, PlaygroundResponse,
} from '@/types/domain';

// ----------------- Catálogo (modelos + tools disponíveis) -----------------

export function useAgentCatalog() {
  return useQuery({
    queryKey: ['agents', 'catalog'],
    queryFn: async () => {
      const { data } = await api.get<AgentCatalog>('/agents/catalog');
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

// ----------------- Lista -----------------

export interface AgentFilters {
  page?: number;
  limit?: number;
  provider?: AiProvider | '';
  isActive?: boolean;
  search?: string;
}

export function useAgents(filters: AgentFilters = {}) {
  return useQuery({
    queryKey: ['agents', filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Agent>>('/agents', { params: filters });
      return data;
    },
  });
}

// ----------------- Single -----------------

export function useAgent(id: string | undefined) {
  return useQuery({
    queryKey: ['agents', id],
    queryFn: async () => {
      const { data } = await api.get<Agent>(`/agents/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ----------------- Mutations -----------------

export interface UpsertAgentInput {
  name: string;
  description?: string;
  provider: AiProvider;
  model: string;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  enabledTools?: string[];
  isActive?: boolean;
  isDefault?: boolean;
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertAgentInput) => {
      const { data } = await api.post<Agent>('/agents', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agente criado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useUpdateAgent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<UpsertAgentInput>) => {
      const { data } = await api.patch<Agent>(`/agents/${id}`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agente atualizado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/agents/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agente removido');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

// ----------------- Playground -----------------

export function usePlayground(agentId: string) {
  return useMutation({
    mutationFn: async (input: { message: string; customerId: string }) => {
      const { data } = await api.post<PlaygroundResponse>(
        `/agents/${agentId}/playground`,
        input,
      );
      return data;
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

// ----------------- Usage -----------------

export function useAgentUsage(agentId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['agents', agentId, 'usage', days],
    queryFn: async () => {
      const { data } = await api.get<AgentUsageStats>(`/agents/${agentId}/usage`, {
        params: { days },
      });
      return data;
    },
    enabled: !!agentId,
  });
}
