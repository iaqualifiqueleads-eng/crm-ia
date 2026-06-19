import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Customer, CustomerEvent, CustomerStatus, ForecastMode, Paginated, Interaction } from '@/types';

export interface CustomerFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatus | '';
  salespersonId?: string;
  onlyOverdue?: boolean;
}

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Customer>>('/customers', { params: filters });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const { data } = await api.get<Customer>(`/customers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCustomerTimeline(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id, 'timeline'],
    queryFn: async () => {
      const { data } = await api.get<CustomerEvent[]>(`/customers/${id}/timeline`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCustomerInteractions(id: string | undefined) {
  return useQuery({
    queryKey: ['customers', id, 'interactions'],
    queryFn: async () => {
      const { data } = await api.get<Interaction[]>(`/interactions/customer/${id}/timeline`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export interface CreateCustomerInput {
  companyName: string;
  tradeName?: string;
  cnpj?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  contactName?: string;
  contactRole?: string;
  city?: string;
  state?: string;
  status?: CustomerStatus;
  origin?: string;
  notes?: string;
  forecastMode?: ForecastMode;
  manualIntervalDays?: number;
  salespersonId?: string;
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data } = await api.post<Customer>('/customers', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Cliente cadastrado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<CreateCustomerInput>) => {
      const { data } = await api.patch<Customer>(`/customers/${id}`, input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['customers', id] });
      toast.success('Cliente atualizado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/customers/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Cliente arquivado');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
