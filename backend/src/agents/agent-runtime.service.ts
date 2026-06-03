import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AiProvider, InteractionDirection, InteractionStatus, InteractionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AIProviderRegistry } from '../ai/ai.registry';
import { ChatMessage, ChatRequest, ChatResponse } from '../ai/ai.types';
import { calculateCostUsd } from '../ai/ai.catalog';
import { ToolRegistry } from './tools/tool.registry';
import { ToolExecutionContext } from './tools/tool.types';

const HISTORY_WINDOW = 50;   // últimas 50 interações da conversa
const MAX_TOOL_LOOPS = 5;    // safety: máx 5 idas e voltas IA↔tools antes de forçar parada

export interface AgentTurnInput {
  agentId: string;
  customerId: string;
  /** Texto da mensagem entrante do cliente (já registrado em interactions) */
  userMessage: string;
  /** ID da Interaction que disparou esse turno (para ligar ao tool call) */
  triggerInteractionId?: string;
  /** Se vier de playground, marca para não tocar em forecast/etc. */
  source?: 'playground' | 'conversation';
  /** Se vier de playground, pode forçar não persistir interactions */
  persist?: boolean;
}

export interface AgentTurnResult {
  /** Texto final que o agente devolve pro cliente */
  responseText: string;
  /** Indica que conversa deve encerrar (transfer/churn) */
  ended: boolean;
  /** Se transfere pra humano, motivo */
  transferReason?: string;
  /** Resumo dos tool calls executados nesse turno */
  toolCallsSummary: Array<{ name: string; summary: string }>;
  /** ID da interaction outbound criada (se persistido) */
  outboundInteractionId?: string;
  /** Métricas agregadas do turno (pode ter múltiplas chamadas de LLM por causa do loop) */
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

@Injectable()
export class AgentRuntimeService {
  private readonly logger = new Logger(AgentRuntimeService.name);
  private readonly usdBrlRate: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: AIProviderRegistry,
    private readonly tools: ToolRegistry,
    config: ConfigService,
  ) {
    this.usdBrlRate = Number(config.get<string>('USD_BRL_RATE') ?? '5.20');
  }

  // ----------------------------------------------------------
  // PUBLIC: executa um turno completo
  // ----------------------------------------------------------
  async runTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
    const persist = input.persist !== false;
    const source = input.source ?? 'conversation';

    const agent = await this.loadAgent(input.agentId);
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      include: { salesperson: { select: { id: true, name: true } } },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    // Monta o histórico
    const history = await this.buildHistory(input.customerId, input.userMessage);

    // Tools
    const enabledTools = (agent.enabledTools ?? '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const toolDefinitions = this.tools.definitions(enabledTools);

    // Prompt do sistema enriquecido com contexto do cliente
    const systemPrompt = this.enrichSystemPrompt(agent.systemPrompt, customer);

    const ctx: ToolExecutionContext = {
      agentId: agent.id,
      customerId: customer.id,
      triggerInteractionId: input.triggerInteractionId,
      source,
    };

    // ---- Loop principal de IA + tools ----
    let messages = [...history];
    let finalText = '';
    let ended = false;
    let transferReason: string | undefined;
    const toolCallsSummary: Array<{ name: string; summary: string }> = [];

    const aggUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0, costUsd: 0, costBrl: 0, llmCalls: 0, latencyMs: 0 };

    const provider = this.providers.get(agent.provider as AiProvider);

    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      const t0 = Date.now();
      const req: ChatRequest = {
        model: agent.model,
        systemPrompt,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        messages,
        tools: toolDefinitions.length > 0 ? toolDefinitions : undefined,
      };

      let resp: ChatResponse;
      try {
        resp = await provider.chat(req);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await this.recordUsageError(agent, customer.id, source, msg, Date.now() - t0);
        throw err;
      }
      const latency = Date.now() - t0;

      // Telemetria
      const costUsd = calculateCostUsd(agent.model, resp.usage.promptTokens, resp.usage.completionTokens);
      const costBrl = Number((costUsd * this.usdBrlRate).toFixed(4));
      aggUsage.promptTokens += resp.usage.promptTokens;
      aggUsage.completionTokens += resp.usage.completionTokens;
      aggUsage.totalTokens += resp.usage.totalTokens;
      aggUsage.costUsd += costUsd;
      aggUsage.costBrl += costBrl;
      aggUsage.llmCalls += 1;
      aggUsage.latencyMs += latency;

      await this.recordUsage(agent, customer.id, source, resp, costUsd, costBrl, latency);

      // Se não houve tool calls — modelo respondeu com texto final
      if (!resp.toolCalls || resp.toolCalls.length === 0) {
        finalText = resp.content;
        break;
      }

      // Adiciona a mensagem do assistant (com tool_calls)
      messages.push({
        role: 'assistant',
        content: resp.content,
        toolCalls: resp.toolCalls,
      });

      // Executa cada tool e injeta o resultado
      for (const tc of resp.toolCalls) {
        try {
          const r = await this.tools.execute(tc.name, tc.arguments, ctx);
          toolCallsSummary.push({ name: tc.name, summary: r.summary });

          messages.push({
            role: 'tool',
            toolCallId: tc.id,
            toolName: tc.name,
            content: JSON.stringify(r.data),
          });

          if (r.endsConversation) {
            ended = true;
            if (r.transferToHuman) transferReason = r.transferReason;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          messages.push({
            role: 'tool',
            toolCallId: tc.id,
            toolName: tc.name,
            content: JSON.stringify({ error: msg }),
          });
        }
      }

      // Se uma tool terminou a conversa, faz uma última passada pra gerar texto final
      // (pra IA confirmar a ação ao cliente em uma frase amigável)
      if (ended) {
        const t1 = Date.now();
        const closingReq: ChatRequest = {
          ...req,
          messages,
          tools: undefined, // sem tools no fechamento
        };
        try {
          const closing = await provider.chat(closingReq);
          const closingLatency = Date.now() - t1;
          const closingUsd = calculateCostUsd(agent.model, closing.usage.promptTokens, closing.usage.completionTokens);
          const closingBrl = Number((closingUsd * this.usdBrlRate).toFixed(4));

          aggUsage.promptTokens += closing.usage.promptTokens;
          aggUsage.completionTokens += closing.usage.completionTokens;
          aggUsage.totalTokens += closing.usage.totalTokens;
          aggUsage.costUsd += closingUsd;
          aggUsage.costBrl += closingBrl;
          aggUsage.llmCalls += 1;
          aggUsage.latencyMs += closingLatency;
          await this.recordUsage(agent, customer.id, source, closing, closingUsd, closingBrl, closingLatency);

          finalText = closing.content || 'Te transferi para o vendedor responsável. Em instantes ele continua daqui. 🙏';
        } catch {
          finalText = 'Te transferi para o vendedor responsável. Em instantes ele continua daqui. 🙏';
        }
        break;
      }
    }

    // Persiste a resposta da IA como Interaction outbound
    let outboundInteractionId: string | undefined;
    if (persist && finalText.trim()) {
      const outbound = await this.prisma.interaction.create({
        data: {
          customerId: customer.id,
          type: InteractionType.WHATSAPP_AI,
          direction: InteractionDirection.OUTBOUND,
          status: InteractionStatus.PENDING,
          content: finalText,
          channel: 'whatsapp',
          jsonMetadata: JSON.stringify({
            agentId: agent.id,
            agentName: agent.name,
            model: agent.model,
            toolCalls: toolCallsSummary,
            usage: aggUsage,
          }),
        },
      });
      outboundInteractionId = outbound.id;
    }

    return {
      responseText: finalText,
      ended,
      transferReason,
      toolCallsSummary,
      outboundInteractionId,
      usage: aggUsage,
    };
  }

  // ----------------------------------------------------------
  // PUBLIC: resolve qual agente atende um cliente
  //   - Se customer.agentId definido, usa esse
  //   - Senão, usa o agente DEFAULT do workspace
  //   - Se não há nenhum, retorna null
  // ----------------------------------------------------------
  async resolveAgentForCustomer(customerId: string): Promise<{ id: string } | null> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { agentId: true },
    });
    if (customer?.agentId) {
      const a = await this.prisma.agent.findFirst({
        where: { id: customer.agentId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (a) return a;
    }
    return this.prisma.agent.findFirst({
      where: { isDefault: true, isActive: true, deletedAt: null },
      select: { id: true },
    });
  }

  // ----------------------------------------------------------
  // PRIVATE
  // ----------------------------------------------------------
  private async loadAgent(agentId: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, isActive: true, deletedAt: null },
    });
    if (!agent) throw new NotFoundException('Agente não encontrado ou inativo');
    return agent;
  }

  /**
   * Constrói o histórico para o LLM:
   *  - Pega as últimas N interactions WHATSAPP/WHATSAPP_AI/NOTE do cliente
   *  - Converte para o formato neutro ChatMessage
   *  - Acrescenta a mensagem atual do usuário no final
   */
  private async buildHistory(customerId: string, currentUserMessage: string): Promise<ChatMessage[]> {
    const recent = await this.prisma.interaction.findMany({
      where: {
        customerId,
        type: { in: [InteractionType.WHATSAPP, InteractionType.WHATSAPP_AI] },
      },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_WINDOW,
    });
    recent.reverse(); // cronológico

    const history: ChatMessage[] = recent.map((it: any) => ({
      role: it.direction === InteractionDirection.INBOUND ? 'user' : 'assistant',
      content: it.content,
    }));

    history.push({ role: 'user', content: currentUserMessage });
    return history;
  }

  /**
   * Injeta no system prompt informações úteis do cliente para o agente.
   */
  private enrichSystemPrompt(basePrompt: string, customer: any): string {
    const ctx = [
      basePrompt,
      '',
      '— CONTEXTO DO CLIENTE QUE VOCÊ ESTÁ ATENDENDO —',
      `Empresa: ${customer.companyName}`,
      customer.contactName ? `Pessoa de contato: ${customer.contactName}${customer.contactRole ? ` (${customer.contactRole})` : ''}` : '',
      `Status atual: ${customer.status}`,
      customer.lastOrderAt ? `Última compra: ${new Date(customer.lastOrderAt).toLocaleDateString('pt-BR')}` : 'Sem histórico de compra',
      customer.daysOverdue > 0 ? `⚠️ Está ${customer.daysOverdue} dias atrasado na previsão de recompra.` : '',
      customer.salesperson?.name ? `Vendedor responsável: ${customer.salesperson.name}` : '',
      '',
      '— LEMBRE-SE —',
      '• Seja conciso. Mensagens curtas funcionam melhor no WhatsApp.',
      '• Use português brasileiro natural.',
      '• Quando o cliente quiser fechar uma compra, chame register_order e depois transfer_to_human.',
      '• Quando o cliente pedir para falar com um humano, chame transfer_to_human imediatamente.',
    ].filter(Boolean).join('\n');
    return ctx;
  }

  private async recordUsage(
    agent: any,
    customerId: string,
    source: 'playground' | 'conversation',
    resp: ChatResponse,
    costUsd: number,
    costBrl: number,
    latencyMs: number,
  ) {
    try {
      await this.prisma.aiUsage.create({
        data: {
          agentId: agent.id,
          customerId,
          provider: agent.provider,
          model: agent.model,
          promptTokens: resp.usage.promptTokens,
          completionTokens: resp.usage.completionTokens,
          totalTokens: resp.usage.totalTokens,
          costUsd,
          costBrl,
          latencyMs,
          source,
        },
      });
    } catch (e) {
      this.logger.warn(`Falha ao registrar AiUsage: ${(e as Error).message}`);
    }
  }

  private async recordUsageError(
    agent: any,
    customerId: string,
    source: 'playground' | 'conversation',
    errorMessage: string,
    latencyMs: number,
  ) {
    try {
      await this.prisma.aiUsage.create({
        data: {
          agentId: agent.id,
          customerId,
          provider: agent.provider,
          model: agent.model,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          costUsd: 0,
          costBrl: 0,
          latencyMs,
          source,
          errorMessage: errorMessage.slice(0, 1000),
        },
      });
    } catch { /* ignora */ }
  }
}
