import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AutomationService } from './automation.service';
import { UpdateReplenishmentConfigDto } from './dto/automation.dto';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Automation')
@ApiBearerAuth('access-token')
@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

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
}
