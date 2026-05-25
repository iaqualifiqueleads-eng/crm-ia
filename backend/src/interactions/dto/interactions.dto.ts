import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { InteractionDirection, InteractionStatus, InteractionType } from '@prisma/client';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateInteractionDto {
  @ApiProperty() @IsUUID() customerId: string;

  @ApiProperty({ enum: InteractionType }) @IsEnum(InteractionType)
  type: InteractionType;

  @ApiPropertyOptional({ enum: InteractionDirection, default: InteractionDirection.OUTBOUND })
  @IsOptional() @IsEnum(InteractionDirection)
  direction?: InteractionDirection;

  @ApiProperty() @IsString()
  content: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50)
  channel?: string;

  @ApiPropertyOptional() @IsOptional() @IsUUID()
  templateId?: string;
}

export class IncomingMessageDto {
  @ApiProperty({ description: 'ID externo da mensagem recebida (ex.: id do WhatsApp)' })
  @IsString() @MaxLength(191)
  externalId: string;

  @ApiProperty({ description: 'Número/identificador remetente' })
  @IsString() @MaxLength(50)
  from: string;

  @ApiProperty()
  @IsString()
  text: string;

  @ApiPropertyOptional()
  @IsOptional() @Type(() => Date) @IsDate()
  receivedAt?: Date;
}

export class InteractionFiltersDto extends PaginationDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() customerId?: string;
  @ApiPropertyOptional({ enum: InteractionType }) @IsOptional() @IsEnum(InteractionType) type?: InteractionType;
  @ApiPropertyOptional({ enum: InteractionStatus }) @IsOptional() @IsEnum(InteractionStatus) status?: InteractionStatus;
}
