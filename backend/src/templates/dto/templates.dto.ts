import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TemplateTrigger } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateTemplateDto {
  @ApiProperty()
  @IsString() @MinLength(2) @MaxLength(150)
  name: string;

  @ApiProperty({ enum: TemplateTrigger })
  @IsEnum(TemplateTrigger)
  trigger: TemplateTrigger;

  @ApiProperty({
    description: 'Corpo da mensagem. Use {{contactName}}, {{daysOverdue}}, {{companyName}}, {{nextReplenishmentAt}} como placeholders.',
  })
  @IsString() @MinLength(5)
  body: string;

  @ApiPropertyOptional({
    description: 'Instruções opcionais para a IA refinar o tom da mensagem antes de enviar',
  })
  @IsOptional() @IsString()
  aiInstructions?: string;

  @ApiPropertyOptional({ default: 'whatsapp' })
  @IsOptional() @IsString() @MaxLength(50)
  channel?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateDto extends PartialType(CreateTemplateDto) {}

export class TemplateFiltersDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TemplateTrigger })
  @IsOptional() @IsEnum(TemplateTrigger)
  trigger?: TemplateTrigger;

  @ApiPropertyOptional()
  @IsOptional() @IsBoolean()
  isActive?: boolean;
}
