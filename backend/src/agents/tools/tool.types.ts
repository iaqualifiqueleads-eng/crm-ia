/**
 * Contrato de uma tool que o agente pode chamar durante a conversa.
 *
 * Cada tool:
 *  - tem schema JSON estrito (validado antes da execução)
 *  - recebe contexto da chamada (cliente, agente, autor)
 *  - retorna um objeto JSON serializável que volta pro modelo
 */

import { ToolDefinition } from '../../ai/ai.types';

export interface ToolExecutionContext {
  agentId: string;
  customerId: string;
  // ID da interaction que originou a chamada (mensagem do cliente)
  triggerInteractionId?: string;
  // Se vier de playground, marca como tal
  source: 'playground' | 'conversation';
}

export interface ToolExecutionResult {
  /** Texto curto a ser exibido na timeline do CRM (ex: "Pedido #12 registrado") */
  summary: string;
  /** Payload arbitrário JSON que volta pro modelo (a IA "vê" esse JSON) */
  data: Record<string, any>;
  /** Se true, sinaliza que a conversa deve encerrar após essa tool */
  endsConversation?: boolean;
  /** Se true, sinaliza que precisa entregar pra humano */
  transferToHuman?: boolean;
  /** Motivo da transferência (preenchido com transferToHuman=true) */
  transferReason?: string;
}

/**
 * Toda tool deve implementar este contrato.
 */
export interface AgentTool {
  /** Nome único (ex: "register_order"). Vai pro modelo no schema. */
  readonly name: string;

  /** Descrição em pt-BR. O modelo lê isso para decidir quando chamar. */
  readonly description: string;

  /** JSON Schema dos parâmetros. */
  readonly parameters: ToolDefinition['parameters'];

  /** Executa a tool. Pode lançar erros — o runtime captura e devolve ao modelo. */
  execute(args: Record<string, any>, context: ToolExecutionContext): Promise<ToolExecutionResult>;
}

export const AGENT_TOOLS = Symbol('AGENT_TOOLS');
