export type UserRole = 'MANAGER' | 'SUPERVISOR' | 'SALESPERSON';

export type CustomerStatus = 'LEAD' | 'PROSPECT' | 'ACTIVE' | 'AT_RISK' | 'CHURNED';

export type ForecastMode = 'AUTO' | 'MANUAL';

export type OrderChannel = 'WHATSAPP' | 'PHONE' | 'EMAIL' | 'IN_PERSON' | 'ECOMMERCE' | 'OTHER';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'CANCELED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskType =
  | 'CALL' | 'EMAIL' | 'MEETING' | 'FOLLOW_UP' | 'VISIT'
  | 'REPLENISHMENT_DUE' | 'REPLENISHMENT_OVERDUE';

export type InteractionType =
  | 'CALL' | 'EMAIL' | 'MEETING'
  | 'WHATSAPP' | 'WHATSAPP_AI' | 'NOTE' | 'SYSTEM';

export type InteractionDirection = 'OUTBOUND' | 'INBOUND' | 'INTERNAL';
export type InteractionStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'REPLIED' | 'FAILED';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  phone?: string | null;
  avatarUrl?: string | null;
  supervisorId?: string | null;
  createdAt: string;
}

export interface Customer {
  id: string;
  companyName: string;
  tradeName?: string | null;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  contactName?: string | null;
  contactRole?: string | null;
  status: CustomerStatus;
  origin?: string | null;
  tags?: string | null;
  notes?: string | null;
  salespersonId: string;
  salesperson?: { id: string; name: string; email: string; role: UserRole } | null;

  forecastMode: ForecastMode;
  forecastIntervalDays?: number | null;
  manualIntervalDays?: number | null;
  lastOrderAt?: string | null;
  nextReplenishmentAt?: string | null;
  daysOverdue: number;

  totalOrders: number;
  totalRevenue: string | number;
  averageTicket: string | number;

  createdAt: string;
  updatedAt: string;
}

export interface Paginated<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    supervisorId: string | null;
  };
}

export interface DashboardSummary {
  totals: {
    customers: number;
    overdueCustomers: number;
    dueSoonCustomers: number;
    newCustomersInPeriod: number;
    pendingTasks: number;
    overdueTasks: number;
    periodRevenue: number | string;
    periodOrders: number;
  };
  customersByStatus: Record<CustomerStatus, number>;
  overdueBuckets: Array<{ bucket: string; total: number }>;
  newCustomersDaily: Array<{ day: string; total: number }>;
  topSalespeople: Array<{ salespersonId: string; name: string; totalRevenue: number; orderCount: number }>;
  meta: { scopedToUserIds: number; periodDays: number };
}

export interface CustomerEvent {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  metadata?: string | null;
  createdAt: string;
  author?: { id: string; name: string; role: UserRole } | null;
}
