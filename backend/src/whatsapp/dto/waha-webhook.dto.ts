import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO para Webhooks do WAHA.
 * 
 * A WAHA envia eventos com uma estrutura clara:
 * - event: tipo do evento (ex: 'message', 'message.any', 'state.change')
 * - payload: dados do evento
 * - session: nome da sessão (opcional)
 * 
 * Diferente da Evolution, o WAHA é mais consistente no formato JSON.
 */
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
}