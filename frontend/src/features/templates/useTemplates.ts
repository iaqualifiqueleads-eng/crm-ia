import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Paginated } from '@/types';
import type { MessageTemplate, TemplateTrigger } from '@/types/domain';

export interface TemplateFilters {
  page?: number;
  limit?: number;
  trigger?: TemplateTrigger | '';
  isActive?: boolean;
  search?: string;
}

export function useTemplates(filters: TemplateFilters = {}) {
  return useQuery({
    queryKey: ['templates', filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<MessageTemplate>>('/templates', { params: filters });
      return data;
    },
  });
}

export interface UpsertTemplateInput {
  name: string;
  trigger: TemplateTrigger;
  body: string;
  aiInstructions?: string;
  channel?: string;
  isActive?: boolean;
}

export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTemplateInput) => {
      const { data } = await api.post<MessageTemplate>('/templates', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template criado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useUpdateTemplate(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<UpsertTemplateInput>) => {
      const { data } = await api.patch<MessageTemplate>(`/templates/${id}`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template atualizado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useDeleteTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/templates/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template removido');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
