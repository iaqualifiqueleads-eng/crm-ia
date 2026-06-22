import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CustomerStatus, ForecastMode } from '@prisma/client';
import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateCustomerDto {
  @ApiProperty({ example: 'Construtora Alpha LTDA' })
  @IsString()
  @MaxLength(200)
  companyName: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(200)
  tradeName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(20)
  cnpj?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsEmail() @MaxLength(191)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(30)
  whatsapp?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(255)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) state?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) zipCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(150) contactName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) contactRole?: string;

  @ApiPropertyOptional({ enum: CustomerStatus, default: CustomerStatus.LEAD })
  @IsOptional() @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) origin?: string;

  @ApiPropertyOptional({ description: 'Tags separadas por vírgula' })
  @IsOptional() @IsString()
  tags?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;

  @ApiPropertyOptional({
    description:
      'ID do vendedor responsável. Se omitido, é atribuído ao próprio usuário (se vendedor) ou exigido (se manager/supervisor).',
  })
  @IsOptional() @IsUUID()
  salespersonId?: string;

  // Previsão manual opcional ao criar
  @ApiPropertyOptional({ enum: ForecastMode, default: ForecastMode.AUTO })
  @IsOptional() @IsEnum(ForecastMode)
  forecastMode?: ForecastMode;

  @ApiPropertyOptional({ description: 'Intervalo manual em dias (sobrescreve o automático)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  manualIntervalDays?: number;

  @ApiPropertyOptional({ description: 'Delay em minutos antes de disparar o primeiro contato via WhatsApp (útil em importações em massa)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0)
  firstContactDelayMinutes?: number;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

export class TransferCustomerDto {
  @ApiProperty({ description: 'ID do novo vendedor responsável' })
  @IsUUID()
  toSalespersonId: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  reason?: string;
}

export class CustomerFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: CustomerStatus })
  @IsOptional() @IsEnum(CustomerStatus)
  status?: CustomerStatus;

  @ApiPropertyOptional()
  @IsOptional() @IsUUID()
  salespersonId?: string;

  @ApiPropertyOptional({ description: 'true para listar apenas atrasados' })
  @IsOptional() @Type(() => Boolean)
  onlyOverdue?: boolean;
}
