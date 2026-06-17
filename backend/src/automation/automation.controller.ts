import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AutomationService } from './automation.service';
import { UpdateReplenishmentConfigDto } from './dto/automation.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { SchedulerService } from '../workers/scheduler.service';

@ApiTags('Automation')
@ApiBearerAuth('access-token')
@Controller('automation')
export class AutomationController {
  constructor(
    private readonly automationService: AutomationService,
    private readonly schedulerService: SchedulerService,
  ) {}

  @Get('queue')
  @ApiOperation({ summary: 'Lista contatos agendados e jobs pendentes no BullMQ' })
  getQueue() {
    return this.automationService.getQueueSummary();
  }

  @Get('replenishment')
  @ApiOperation({ summary: 'Lê configuração de cadência de reposição' })
  getReplenishment() {
    return this.automationService.getReplenishmentConfig();
  }

  @Put('replenishment')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Atualiza cadência de reposição (apenas gerente)' })
  updateReplenishment(@Body() dto: UpdateReplenishmentConfigDto) {
    return this.automationService.upsertReplenishmentConfig(dto);
  }

  @Post('replenishment/trigger')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Dispara replenishment manualmente (apenas gerente)' })
  async triggerReplenishment() {
    await this.schedulerService.triggerReplenishmentNow();
    return { message: 'Replenishment disparado com sucesso' };
  }

  @Post('overdue/trigger')
  @Roles(UserRole.MANAGER)
  @ApiOperation({ summary: 'Dispara overdue escalation manualmente (apenas gerente)' })
  async triggerOverdue() {
    await this.schedulerService.triggerOverdueNow();
    return { message: 'Overdue escalation disparado com sucesso' };
  }
}