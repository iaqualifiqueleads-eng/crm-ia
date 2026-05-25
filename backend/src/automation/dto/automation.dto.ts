import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsInt, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

class RetryTemplatesDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() retry1h?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() retry3h?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() retry24h?: string;
}

export class UpdateReplenishmentConfigDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ default: 0, minimum: 0, maximum: 30 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30)
  remindBeforeDays?: number;

  @ApiPropertyOptional({
    description: 'Intervalos de retry em horas, exatamente 3 valores [1ª, 2ª, 3ª]',
    example: [1, 3, 24],
  })
  @IsOptional() @IsArray()
  retryDelaysHours?: [number, number, number];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30)
  overdueTaskAfterDays?: number;

  @ApiPropertyOptional({ default: 3 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60)
  escalateToManagementAfterDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  defaultReminderTemplateId?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  overdueTemplateId?: string;

  @ApiPropertyOptional({ type: RetryTemplatesDto })
  @IsOptional() @ValidateNested() @Type(() => RetryTemplatesDto)
  retryTemplateIds?: RetryTemplatesDto;
}
