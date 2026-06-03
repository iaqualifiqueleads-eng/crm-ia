import {
  Injectable, ForbiddenException, NotFoundException,
  BadRequestException, ConflictException,
} from '@nestjs/common';
import { AiProvider, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { buildPaginatedResult } from '../common/dto/pagination.dto';
import {
  CreateAgentDto, UpdateAgentDto, AgentFiltersDto, PlaygroundMessageDto,
} from './dto/agents.dto';
import { AgentRuntimeService } from './agent-runtime.service';
import { ToolRegistry } from './tools/tool.registry';
import { MODEL_CATALOG, MODEL_PRICING } from '../ai/ai.catalog';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly runtime: AgentRuntimeService,
    private readonly tools: ToolRegistry,
  ) {}

  // ----- catálogo (público p/ qualquer usuário autenticado) -----
  getCatalog() {
    return {
      providers: Object.keys(MODEL_CATALOG),
      models: MODEL_CATALOG,
      pricing: MODEL_PRICING,
      tools: this.tools.catalog(),
    };
  }

  // ----- create -----
  async create(actor: CurrentUserPayload, dto: CreateAgentDto) {
    this.assertCanManage(actor);
    this.validateModelMatchesProvider(dto.provider, dto.model);

    // Se o usuário marcou isDefault, desmarca o anterior (só pode haver 1)
    if (dto.isDefault) {
      await this.prisma.agent.updateMany({
        where: { isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const created = await this.prisma.agent.create({
      data: {
        name: dto.name,
        description: dto.description,
        provider: dto.provider,
        model: dto.model,
        systemPrompt: dto.systemPrompt,
        temperature: dto.temperature ?? 0.7,
        maxTokens: dto.maxTokens ?? 1024,
        enabledTools: dto.enabledTools?.join(',') ?? null,
        isActive: dto.isActive ?? true,
        isDefault: dto.isDefault ?? false,
        createdById: actor.sub,
      },
    });
    return created;
  }

  // ----- list -----
  async findAll(actor: CurrentUserPayload, filters: AgentFiltersDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;

    const where: Prisma.AgentWhereInput = {
      deletedAt: null,
      ...(filters.provider ? { provider: filters.provider } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.search
        ? { OR: [
            { name: { contains: filters.search } },
            { description: { contains: filters.search } },
          ] }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true } },
          _count: { select: { customers: true } },
        },
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.agent.count({ where }),
    ]);

    return buildPaginatedResult(data, total, page, limit);
  }

  // ----- find one -----
  async findOne(_actor: CurrentUserPayload, id: string) {
    const agent = await this.prisma.agent.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, name: true } },
        _count: { select: { customers: true, aiUsages: true } },
      },
    });
    if (!agent) throw new NotFoundException();
    return agent;
  }

  // ----- update -----
  async update(actor: CurrentUserPayload, id: string, dto: UpdateAgentDto) {
    this.assertCanManage(actor);

    const agent = await this.prisma.agent.findFirst({ where: { id, deletedAt: null } });
    if (!agent) throw new NotFoundException();

    if (dto.provider && dto.model) {
      this.validateModelMatchesProvider(dto.provider, dto.model);
    } else if (dto.model && !dto.provider) {
      this.validateModelMatchesProvider(agent.provider, dto.model);
    } else if (dto.provider && !dto.model) {
      this.validateModelMatchesProvider(dto.provider, agent.model);
    }

    if (dto.isDefault) {
      await this.prisma.agent.updateMany({
        where: { isDefault: true, id: { not: id }, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return this.prisma.agent.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        provider: dto.provider,
        model: dto.model,
        systemPrompt: dto.systemPrompt,
        temperature: dto.temperature,
        maxTokens: dto.maxTokens,
        enabledTools: dto.enabledTools ? dto.enabledTools.join(',') : undefined,
        isActive: dto.isActive,
        isDefault: dto.isDefault,
      },
    });
  }

  // ----- delete (soft) -----
  async remove(actor: CurrentUserPayload, id: string) {
    this.assertCanManage(actor);
    const agent = await this.prisma.agent.findFirst({ where: { id, deletedAt: null } });
    if (!agent) throw new NotFoundException();
    if (agent.isDefault) {
      throw new BadRequestException('Marque outro agente como default antes de excluir este.');
    }
    await this.prisma.agent.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    return { success: true };
  }

  // ----- playground -----
  async playground(actor: CurrentUserPayload, agentId: string, dto: PlaygroundMessageDto) {
    // Qualquer usuário autenticado com acesso ao cliente pode testar
    const customer = await this.prisma.customer.findFirst({
      where: { id: dto.customerId, deletedAt: null },
      select: { id: true, salespersonId: true },
    });
    if (!customer) throw new NotFoundException('Cliente não encontrado');

    if (actor.role === UserRole.SALESPERSON && customer.salespersonId !== actor.sub) {
      throw new ForbiddenException('Cliente fora do seu escopo');
    }

    const result = await this.runtime.runTurn({
      agentId,
      customerId: dto.customerId,
      userMessage: dto.message,
      source: 'playground',
      persist: false,           // playground não persiste interactions
    });

    return result;
  }

  // ----- usage stats -----
  async usageStats(_actor: CurrentUserPayload, id: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [aggregate, byDay] = await Promise.all([
      this.prisma.aiUsage.aggregate({
        where: { agentId: id, createdAt: { gte: since }, errorMessage: null },
        _sum: { promptTokens: true, completionTokens: true, totalTokens: true, costUsd: true, costBrl: true },
        _count: { _all: true },
        _avg: { latencyMs: true },
      }),
      (this.prisma.$queryRaw as any)(Prisma.sql`
        SELECT DATE(\`createdAt\`) AS day,
               COUNT(*)            AS total,
               COALESCE(SUM(\`costBrl\`), 0) AS cost
        FROM ai_usages
        WHERE \`agentId\` = ${id} AND \`createdAt\` >= ${since}
        GROUP BY DATE(\`createdAt\`)
        ORDER BY day ASC
      `) as Promise<Array<{ day: Date; total: bigint; cost: number }>>,
    ]);

    return {
      periodDays: days,
      totalCalls: aggregate._count._all,
      totalTokens: aggregate._sum.totalTokens ?? 0,
      promptTokens: aggregate._sum.promptTokens ?? 0,
      completionTokens: aggregate._sum.completionTokens ?? 0,
      costUsd: aggregate._sum.costUsd ?? 0,
      costBrl: aggregate._sum.costBrl ?? 0,
      avgLatencyMs: Math.round(aggregate._avg.latencyMs ?? 0),
      daily: byDay.map((row) => ({
        day: row.day,
        total: Number(row.total),
        costBrl: Number(row.cost),
      })),
    };
  }

  // ----- helpers -----
  private assertCanManage(actor: CurrentUserPayload) {
    if (actor.role === UserRole.SALESPERSON) {
      throw new ForbiddenException('Vendedores não gerenciam agentes');
    }
  }

  private validateModelMatchesProvider(provider: AiProvider, model: string) {
    const models = MODEL_CATALOG[provider] ?? [];
    const valid = models.some((m) => m.id === model);
    if (!valid) {
      throw new BadRequestException(
        `Modelo "${model}" não pertence ao provider ${provider}. Modelos válidos: ${models.map((m) => m.id).join(', ')}`,
      );
    }
  }
}
