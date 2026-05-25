import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Paginated } from '@/types';
import type { Task } from '@/types/domain';

export interface TaskFilters {
  page?: number;
  limit?: number;
  status?: string;
  priority?: string;
  type?: string;
  assigneeId?: string;
  customerId?: string;
  scope?: 'today' | 'overdue' | 'upcoming';
  search?: string;
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Task>>('/tasks', { params: filters });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  dueDate?: string;
  assigneeId?: string;
  customerId?: string;
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data } = await api.post<Task>('/tasks', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Tarefa criada');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post<Task>(`/tasks/${id}/complete`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useUpdateTask(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateTaskInput & { status: string }>) => {
      const { data } = await api.patch<Task>(`/tasks/${id}`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/tasks/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa removida');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
