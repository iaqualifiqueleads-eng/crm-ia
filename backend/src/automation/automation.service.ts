import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AutomationKey,
  DEFAULT_REPLENISHMENT_CONFIG,
  ReplenishmentFlowConfig,
} from './automation.types';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getReplenishmentConfig(): Promise<ReplenishmentFlowConfig> {
    const rule = await this.prisma.automationRule.findUnique({
      where: { key: AutomationKey.REPLENISHMENT_FLOW },
    });
    if (!rule || !rule.isActive) return DEFAULT_REPLENISHMENT_CONFIG;
    try {
      const parsed = JSON.parse(rule.config) as ReplenishmentFlowConfig;
      return { ...DEFAULT_REPLENISHMENT_CONFIG, ...parsed };
    } catch (e) {
      this.logger.warn('Falha ao parsear config de automação — usando defaults');
      return DEFAULT_REPLENISHMENT_CONFIG;
    }
  }

  async upsertReplenishmentConfig(
    config: Partial<ReplenishmentFlowConfig>,
  ): Promise<ReplenishmentFlowConfig> {
    const merged = { ...DEFAULT_REPLENISHMENT_CONFIG, ...config };
    const json = JSON.stringify(merged);
    await this.prisma.automationRule.upsert({
      where: { key: AutomationKey.REPLENISHMENT_FLOW },
      create: {
        key: AutomationKey.REPLENISHMENT_FLOW,
        description: 'Cadência automática de reposição',
        config: json,
        isActive: true,
      },
      update: { config: json, isActive: true },
    });
    return merged;
  }
}
