import { IsString, IsUUID, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CampaignPreviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsDateString()
  lastInteractionBefore?: string; // ISO date — clientes cuja última interação foi antes desta data
}

export class CreateCampaignDto {
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  name: string;

  @IsUUID()
  templateId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @IsOptional()
  @IsDateString()
  lastInteractionBefore?: string;
}
