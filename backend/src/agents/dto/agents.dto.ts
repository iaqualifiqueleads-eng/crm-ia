import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AiProvider } from '@prisma/client';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString,
  IsUUID, MaxLength, Min, Max, MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateAgentDto {
  @ApiProperty({ example: 'Vendedor Mestre — Tom Premium' })
  @IsString() @MinLength(2) @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string;

  @ApiProperty({ enum: AiProvider })
  @IsEnum(AiProvider)
  provider: AiProvider;

  @ApiProperty({ example: 'claude-sonnet-4-6' })
  @IsString() @MaxLength(80)
  model: string;

  @ApiProperty({
    description: 'System prompt completo. Defina aqui a persona, regras e proibições do agente.',
  })
  @IsString() @MinLength(20)
  systemPrompt: string;

  @ApiPropertyOptional({ default: 0.7, minimum: 0, maximum: 2 })
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(2)
  temperature?: number;

  @ApiPropertyOptional({ default: 1024, minimum: 128, maximum: 8192 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(128) @Max(8192)
  maxTokens?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Nomes das tools habilitadas (lista do GET /agents/tools)',
    example: ['register_order', 'transfer_to_human'],
  })
  @IsOptional() @IsArray() @IsString({ each: true })
  enabledTools?: string[];

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAgentDto extends PartialType(CreateAgentDto) {}

export class AgentFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: AiProvider })
  @IsOptional() @IsEnum(AiProvider)
  provider?: AiProvider;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class PlaygroundMessageDto {
  @ApiProperty({ description: 'Texto da mensagem como se fosse do cliente' })
  @IsString() @MinLength(1)
  message: string;

  @ApiProperty({ description: 'ID do cliente a usar como contexto da conversa' })
  @IsUUID()
  customerId: string;
}
