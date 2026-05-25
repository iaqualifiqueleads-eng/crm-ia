import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardFiltersDto, DrillDownFiltersDto } from './dto/dashboard.dto';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth('access-token')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Resumo geral do dashboard (escopo por hierarquia)' })
  summary(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getSummary(actor, filters);
  }

  @Get('drill-down')
  @ApiOperation({
    summary: 'Clientes que compõem uma métrica (overdue|dueSoon|active|atRisk|churned|newThisMonth)',
  })
  drillDown(
    @CurrentUser() actor: CurrentUserPayload,
    @Query() filters: DrillDownFiltersDto,
  ) {
    return this.dashboardService.drillDown(actor, filters);
  }
}
