import { Injectable, Logger } from '@nestjs/common';
import { AgentTool, ToolExecutionContext, ToolExecutionResult } from './tool.types';
import { ToolDefinition } from '../../ai/ai.types';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RegisterOrderTool,
  ScheduleTaskTool,
  UpdateCustomerNotesTool,
  TransferToHumanTool,
  UpdateReplenishmentForecastTool,
  MarkNotInterestedTool,
  MarkWellStockedTool,
} from './tools.implementations';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly byName = new Map<string, AgentTool>();

  constructor(
    private readonly prisma: PrismaService,
    registerOrder: RegisterOrderTool,
    scheduleTask: ScheduleTaskTool,
    updateNotes: UpdateCustomerNotesTool,
    transferHuman: TransferToHumanTool,
    updateForecast: UpdateReplenishmentForecastTool,
    markNotInterested: MarkNotInterestedTool,
    markWellStocked: MarkWellStockedTool,
  ) {
    const all = [
      registerOrder, scheduleTask, updateNotes,
      transferHuman, updateForecast, markNotInterested, markWellStocked,
    ];
    for (const tool of all) {
      this.byName.set(tool.name, tool);
    }
  }

  /** Retorna a definição (sem implementação) — vai pro modelo */
  definitionFor(name: string): ToolDefinition | undefined {
    const t = this.byName.get(name);
    if (!t) return undefined;
    return { name: t.name, description: t.description, parameters: t.parameters };
  }

  /** Retorna várias definições; ignora nomes desconhecidos */
  definitions(names: string[]): ToolDefinition[] {
    return names
      .map((n) => this.definitionFor(n))
      .filter((d): d is ToolDefinition => !!d);
  }

  /** Lista de TODAS as tools disponíveis (catálogo para a UI) */
  catalog(): Array<{ name: string; description: string }> {
    return [...this.byName.values()].map((t) => ({ name: t.name, description: t.description }));
  }

  /**
   * Executa uma tool. Captura erros e devolve um resultado padronizado.
   * Sempre registra o tool call no banco.
   */
  async execute(
    name: string,
    args: Record<string, any>,
    ctx: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.byName.get(name);
    if (!tool) {
      throw new Error(`Tool desconhecida: ${name}`);
    }

    const t0 = Date.now();
    try {
      const result = await tool.execute(args, ctx);
      await this.recordCall(name, args, ctx, result, true, null);
      this.logger.log(`Tool ${name} ok (${Date.now() - t0}ms) :: ${result.summary}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await this.recordCall(name, args, ctx, null, false, msg);
      this.logger.error(`Tool ${name} falhou (${Date.now() - t0}ms): ${msg}`);
      throw err;
    }
  }

  private async recordCall(
    toolName: string,
    args: Record<string, any>,
    ctx: ToolExecutionContext,
    result: ToolExecutionResult | null,
    succeeded: boolean,
    errorMessage: string | null,
  ) {
    try {
      await this.prisma.agentToolCall.create({
        data: {
          agentId: ctx.agentId,
          customerId: ctx.customerId,
          interactionId: ctx.triggerInteractionId,
          toolName,
          arguments: JSON.stringify(args).slice(0, 60000),
          result: result ? JSON.stringify(result).slice(0, 60000) : null,
          succeeded,
          errorMessage,
        },
      });
    } catch (e) {
      this.logger.warn(`Falha ao registrar tool call: ${(e as Error).message}`);
    }
  }
}
