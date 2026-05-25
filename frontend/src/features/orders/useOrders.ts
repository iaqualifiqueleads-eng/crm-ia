import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { api, extractErrorMessage } from '@/services/api';
import type { Paginated } from '@/types';
import type { Order } from '@/types/domain';

export interface OrderFilters {
  page?: number;
  limit?: number;
  search?: string;
  customerId?: string;
  channel?: string;
}

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ['orders', filters],
    queryFn: async () => {
      const { data } = await api.get<Paginated<Order>>('/orders', { params: filters });
      return data;
    },
    placeholderData: (prev) => prev,
  });
}

export interface CreateOrderItem {
  productSku?: string;
  productName: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
}

export interface CreateOrderInput {
  customerId: string;
  orderNumber?: string;
  orderedAt: string;
  channel?: string;
  notes?: string;
  items: CreateOrderItem[];
}

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput) => {
      const { data } = await api.post<Order>('/orders', input);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Pedido registrado · previsão recalculada');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}

export function useDeleteOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/orders/${id}`); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
      qc.invalidateQueries({ queryKey: ['customers'] });
      toast.success('Pedido removido');
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });
}
