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

// ============== AGENTS (Fase 3) ==============

export type AiProvider = 'CLAUDE' | 'OPENAI' | 'GEMINI';

export interface Agent {
  id: string;
  name: string;
  description?: string | null;
  provider: AiProvider;
  model: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enabledTools?: string | null;       // CSV no banco
  isActive: boolean;
  isDefault: boolean;
  createdById: string;
  createdBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  _count?: { customers: number; aiUsages?: number };
}

export interface ModelCatalogEntry {
  id: string;
  label: string;
  description: string;
  recommended?: boolean;
}

export interface ToolCatalogEntry {
  name: string;
  description: string;
}

export interface AgentCatalog {
  providers: AiProvider[];
  models: Record<AiProvider, ModelCatalogEntry[]>;
  pricing: Record<string, { input: number; output: number }>;
  tools: ToolCatalogEntry[];
}

export interface AgentUsageStats {
  periodDays: number;
  totalCalls: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number | string;
  costBrl: number | string;
  avgLatencyMs: number;
  daily: Array<{ day: string; total: number; costBrl: number }>;
}

export interface PlaygroundResponse {
  responseText: string;
  ended: boolean;
  transferReason?: string;
  toolCallsSummary: Array<{ name: string; summary: string }>;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    costBrl: number;
    llmCalls: number;
    latencyMs: number;
  };
}
