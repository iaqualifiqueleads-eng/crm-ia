export const QUEUES = {
  AGENT_RESPONSE: 'agent-response',
} as const;

export const JOBS = {
  PROCESS_INBOUND: 'process-inbound',
} as const;

export interface ProcessInboundJobData {
  customerId: string;
  interactionId: string;
  text: string;
}
