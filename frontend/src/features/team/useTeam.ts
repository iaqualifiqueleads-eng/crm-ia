import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Paginated, User, UserRole } from '@/types';

export interface UserFilters {
  page?: number;
  limit?: number;
  role?: UserRole | '';
  search?: string;
}

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: ['users', filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<User & {
        supervisor?: { id: string; name: string; role: UserRole };
        _count?: { customers: number; subordinates: number };
      }>>('/users', { params: filters });
      return data;
    },
  });
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  supervisorId?: string;
  phone?: string;
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await api.post<User>('/users', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Omit<CreateUserInput, 'password' | 'email'> & { isActive: boolean }>) => {
      const { data } = await api.patch<User>(`/users/${id}`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/users/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário desativado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
