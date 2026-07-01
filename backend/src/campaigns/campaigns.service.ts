import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CampaignStatus, CampaignCustomerStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { getVisibleSalespersonIds } from '../common/scope.util';
import { QUEUES, JOBS, CampaignSendJobData } from '../workers/workers.types';
import { CreateCampaignDto, CampaignPreviewDto } from './dto/campaigns.dto';

// Intervalo entre disparos — mesmo padrão do import CSV (i * 10 minutos)
const STAGGER_MINUTES = 10;

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.CAMPAIGN) private readonly campaignQueue: Queue,
  ) {}

  // -------------------------------------------------------
  // PREVIEW — retorna clientes que seriam impactados, sem criar nada
  // -------------------------------------------------------
  async preview(actor: CurrentUserPayload, dto: CampaignPreviewDto) {
    const where = await this.buildCustomerWhere(actor, dto);
    const customers = await this.prisma.customer.findMany({
      where,
      select: {
        id: true,
        companyName: true,
        tradeName: true,
        state: true,
        city: true,
        whatsapp: true,
        status: true,
        salesperson: { select: { id: true, name: true } },
        interactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true, type: true },
        },
      },
      orderBy: { companyName: 'asc' },
    });

    return {
      total: customers.length,
      withWhatsapp: customers.filter((c) => c.whatsapp).length,
      customers: customers.map((c) => ({
        id: c.id,
        companyName: c.companyName,
        tradeName: c.tradeName,
        state: c.state,
        city: c.city,
        whatsapp: c.whatsapp,
        status: c.status,
        salesperson: c.salesperson,
        lastInteractionAt: c.interactions[0]?.createdAt ?? null,
        lastInteractionType: c.interactions[0]?.type ?? null,
      })),
    };
  }

  // -------------------------------------------------------
  // CREATE — cria campanha e enfileira jobs
  // -------------------------------------------------------
  async create(actor: CurrentUserPayload, dto: CreateCampaignDto) {
    // Valida template
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id: dto.templateId, deletedAt: null, isActive: true },
    });
    if (!template) throw new NotFoundException('Template não encontrado ou inativo');

    // Busca clientes elegíveis
    const previewDto: CampaignPreviewDto = {
      state: dto.state,
      lastInteractionBefore: dto.lastInteractionBefore,
    };
    const where = await this.buildCustomerWhere(actor, previewDto);
    const customers = await this.prisma.customer.findMany({
      where,
      select: { id: true, companyName: true, whatsapp: true },
      orderBy: { companyName: 'asc' },
    });

    if (customers.length === 0) {
      throw new BadRequestException('Nenhum cliente encontrado com os filtros informados');
    }

    // Cria campanha
    const campaign = await this.prisma.campaign.create({
      data: {
        name: dto.name,
        status: CampaignStatus.RUNNING,
        filters: JSON.stringify({ state: dto.state, lastInteractionBefore: dto.lastInteractionBefore }),
        templateId: dto.templateId,
        totalCustomers: customers.length,
        createdById: actor.sub,
        executedAt: new Date(),
      },
    });

    // Enfileira jobs com stagger de 10 min (mesmo padrão do CSV)
    let jobIndex = 0;
    for (const customer of customers) {
      if (!customer.whatsapp) {
        // Sem WhatsApp — registra como SKIPPED direto, sem enfileirar
        await this.prisma.campaignCustomer.create({
          data: {
            campaignId: campaign.id,
            customerId: customer.id,
            status: CampaignCustomerStatus.SKIPPED,
            failedReason: 'Sem número WhatsApp',
          },
        });
        continue;
      }

      const automationRef = `CAMPAIGN_${campaign.id}_${customer.id}`;
      const delayMs = jobIndex * STAGGER_MINUTES * 60 * 1000;
      const jobId = `campaign-${campaign.id}-${customer.id}`;

      const jobData: CampaignSendJobData = {
        campaignId: campaign.id,
        campaignCustomerId: '', // preenchido depois do create
        customerId: customer.id,
        templateId: dto.templateId,
        automationRef,
      };

      // Cria registro do cliente na campanha primeiro para ter o id
      const cc = await this.prisma.campaignCustomer.create({
        data: {
          campaignId: campaign.id,
          customerId: customer.id,
          status: CampaignCustomerStatus.PENDING,
          jobId,
        },
      });

      jobData.campaignCustomerId = cc.id;

      await this.campaignQueue.add(JOBS.CAMPAIGN_SEND, jobData, {
        jobId,
        delay: delayMs,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
      });

      jobIndex++;
    }

    // Atualiza totalCustomers com o número final (inclui skipped)
    const skippedCount = customers.filter((c) => !c.whatsapp).length;
    await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { totalCustomers: customers.length, skippedCount },
    });

    this.logger.log(
      `Campanha ${campaign.id} criada: ${customers.length} clientes, ${jobIndex} jobs enfileirados`,
    );

    return this.findOne(actor, campaign.id);
  }

  // -------------------------------------------------------
  // LIST
  // -------------------------------------------------------
  async findAll(actor: CurrentUserPayload) {
    const campaigns = await this.prisma.campaign.findMany({
      where: { createdById: actor.sub },
      include: {
        template: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return campaigns;
  }

  // -------------------------------------------------------
  // FIND ONE
  // -------------------------------------------------------
  async findOne(actor: CurrentUserPayload, id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        template: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        customers: {
          include: {
            customer: {
              select: {
                id: true,
                companyName: true,
                tradeName: true,
                state: true,
                city: true,
                whatsapp: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!campaign) throw new NotFoundException('Campanha não encontrada');
    await this.assertCampaignAccess(actor, campaign);
    return campaign;
  }

  // -------------------------------------------------------
  // PAUSE
  // -------------------------------------------------------
  async pause(actor: CurrentUserPayload, id: string) {
    const campaign = await this.assertMutableCampaign(actor, id, [CampaignStatus.RUNNING]);
    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.PAUSED },
    });
  }

  // -------------------------------------------------------
  // RESUME
  // -------------------------------------------------------
  async resume(actor: CurrentUserPayload, id: string) {
    const campaign = await this.assertMutableCampaign(actor, id, [CampaignStatus.PAUSED]);
    return this.prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: CampaignStatus.RUNNING },
    });
  }

  // -------------------------------------------------------
  // DELETE CAMPAIGN — cancela todos os jobs PENDING e remove
  // -------------------------------------------------------
  async remove(actor: CurrentUserPayload, id: string) {
    const campaign = await this.assertMutableCampaign(actor, id, [
      CampaignStatus.RUNNING,
      CampaignStatus.PAUSED,
      CampaignStatus.DONE,
      CampaignStatus.CANCELLED,
    ]);

    // Remove jobs PENDING da fila
    const pendingEntries = await this.prisma.campaignCustomer.findMany({
      where: { campaignId: id, status: CampaignCustomerStatus.PENDING, jobId: { not: null } },
      select: { jobId: true },
    });

    for (const entry of pendingEntries) {
      if (entry.jobId) {
        try {
          const job = await this.campaignQueue.getJob(entry.jobId);
          await job?.remove();
        } catch (err: any) {
          this.logger.warn(`Falha ao remover job ${entry.jobId}: ${err?.message}`);
        }
      }
    }

    // Cascade deleta CampaignCustomer também (configurado no schema)
    await this.prisma.campaign.delete({ where: { id } });
    this.logger.log(`Campanha ${id} deletada`);
    return { deleted: true };
  }

  // -------------------------------------------------------
  // REMOVE CUSTOMER FROM CAMPAIGN
  // -------------------------------------------------------
  async removeCustomer(actor: CurrentUserPayload, campaignId: string, customerId: string) {
    const campaign = await this.assertMutableCampaign(actor, campaignId, [
      CampaignStatus.RUNNING,
      CampaignStatus.PAUSED,
    ]);

    const cc = await this.prisma.campaignCustomer.findUnique({
      where: { campaignId_customerId: { campaignId, customerId } },
    });

    if (!cc) throw new NotFoundException('Cliente não encontrado nesta campanha');

    // Remove job da fila se ainda estiver PENDING
    if (cc.status === CampaignCustomerStatus.PENDING && cc.jobId) {
      try {
        const job = await this.campaignQueue.getJob(cc.jobId);
        await job?.remove();
      } catch (err: any) {
        this.logger.warn(`Falha ao remover job ${cc.jobId}: ${err?.message}`);
      }
    }

    await this.prisma.campaignCustomer.delete({ where: { id: cc.id } });

    // Atualiza totalCustomers
    const remaining = await this.prisma.campaignCustomer.count({ where: { campaignId } });
    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { totalCustomers: remaining },
    });

    return { removed: true };
  }

  // -------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------

  private async buildCustomerWhere(
    actor: CurrentUserPayload,
    filters: CampaignPreviewDto,
  ): Promise<Prisma.CustomerWhereInput> {
    const visible = await getVisibleSalespersonIds(this.prisma, actor);

    const where: Prisma.CustomerWhereInput = {
      deletedAt: null,
      salespersonId: { in: visible },
    };

    if (filters.state) {
      where.state = { equals: filters.state };
    }

    if (filters.lastInteractionBefore) {
      const cutoff = new Date(filters.lastInteractionBefore);
      // Clientes cuja última interação foi ANTES da data, ou que nunca tiveram interação
      where.OR = [
        {
          interactions: {
            none: {},
          },
        },
        {
          interactions: {
            every: {
              createdAt: { lt: cutoff },
            },
          },
        },
      ];
    }

    return where;
  }

  private async assertCampaignAccess(actor: CurrentUserPayload, campaign: { createdById: string }) {
    // Manager vê tudo; supervisor/vendedor só vê suas campanhas
    if (actor.role !== 'MANAGER' && campaign.createdById !== actor.sub) {
      throw new ForbiddenException('Acesso negado a esta campanha');
    }
  }

  private async assertMutableCampaign(
    actor: CurrentUserPayload,
    id: string,
    allowedStatuses: CampaignStatus[],
  ) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id } });
    if (!campaign) throw new NotFoundException('Campanha não encontrada');
    await this.assertCampaignAccess(actor, campaign);
    if (!allowedStatuses.includes(campaign.status)) {
      throw new BadRequestException(
        `Operação não permitida para campanha com status ${campaign.status}`,
      );
    }
    return campaign;
  }
}
