import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class DashboardFiltersDto {
  @ApiPropertyOptional({ description: 'Período em dias para gráficos (padrão 30)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(365)
  days?: number = 30;

  @ApiPropertyOptional({ description: 'Restringe a um vendedor específico (dentro do escopo)' })
  @IsOptional() @IsUUID()
  salespersonId?: string;
}

export class DrillDownFiltersDto extends DashboardFiltersDto {
  @ApiPropertyOptional({
    description: 'Métrica a abrir: overdue | dueSoon | active | atRisk | churned | newThisMonth',
  })
  @IsOptional() @IsString()
  metric?: string;
}
