import type {
  TaskStatus, TaskPriority, TaskType, OrderChannel,
  InteractionType, InteractionDirection, InteractionStatus,
  UserRole,
} from './index';

export interface OrderItem {
  id: string;
  productSku?: string | null;
  productName: string;
  quantity: number | string;
  unit: string;
  unitPrice: number | string;
  subtotal: number | string;
}

export interface Order {
  id: string;
  customerId: string;
  customer?: { id: string; companyName: string; salespersonId: string } | null;
  createdById: string;
  createdBy?: { id: string; name: string } | null;
  orderNumber?: string | null;
  orderedAt: string;
  channel: OrderChannel;
  totalAmount: number | string;
  totalVolume?: number | string | null;
  currency: string;
  notes?: string | null;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string | null;
  completedAt?: string | null;
  assigneeId: string;
  assignee?: { id: string; name: string; role: UserRole } | null;
  createdById?: string | null;
  createdBy?: { id: string; name: string } | null;
  customerId?: string | null;
  customer?: { id: string; companyName: string; salespersonId: string } | null;
  isAutomatic: boolean;
  automationRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TemplateTrigger =
  | 'FIRST_CONTACT' | 'REPLENISHMENT_REMINDER' | 'REPLENISHMENT_OVERDUE'
  | 'RETRY_1H' | 'RETRY_3H' | 'RETRY_24H' | 'CUSTOM';

export interface MessageTemplate {
  id: string;
  name: string;
  trigger: TemplateTrigger;
  body: string;
  aiInstructions?: string | null;
  channel: string;
  isActive: boolean;
  createdById: string;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface Interaction {
  id: string;
  customerId: string;
  type: InteractionType;
  direction: InteractionDirection;
  status: InteractionStatus;
  content: string;
  channel?: string | null;
  templateId?: string | null;
  template?: { id: string; name: string; trigger: TemplateTrigger } | null;
  authorId?: string | null;
  author?: { id: string; name: string } | null;
  externalId?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  repliedAt?: string | null;
  failedReason?: string | null;
  jsonMetadata?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export interface Notification {
  id: string;
  userId: string;
  severity: NotificationSeverity;
  title: string;
  message: string;
  linkUrl?: string | null;
  customerId?: string | null;
  taskId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface ReplenishmentConfig {
  enabled: boolean;
  remindBeforeDays: number;
  retryDelaysHours: [number, number, number];
  overdueTaskAfterDays: number;
  escalateToManagementAfterDays: number;
  defaultReminderTemplateId?: string;
  overdueTemplateId?: string;
  retryTemplateIds?: {
    retry1h?: string;
    retry3h?: string;
    retry24h?: string;
  };
}
