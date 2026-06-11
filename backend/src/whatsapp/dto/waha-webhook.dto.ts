import { IsObject, IsOptional, IsString } from 'class-validator';

export class WahaWebhookDto {
  @IsString()
  event: string;

  @IsObject()
  payload: any;

  @IsOptional()
  @IsString()
  session?: string;

  @IsOptional()
  metadata?: any;

  @IsOptional()
  id?: any;

  @IsOptional()
  timestamp?: any;

  @IsOptional()
  me?: any;

  @IsOptional()
  engine?: any;

  @IsOptional()
  environment?: any;
}