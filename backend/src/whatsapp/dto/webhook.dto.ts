import { IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Payload genérico do webhook da Evolution.
 * A Evolution emite vários tipos de evento (messages.upsert, connection.update, etc).
 * Aqui aceitamos qualquer payload — o parsing fica no service.
 */
export class EvolutionWebhookDto {
  @IsString()
  event: string;

  @IsOptional() @IsString()
  instance?: string;

  @IsOptional() @IsObject()
  data?: any;

  // Algumas versões enviam direto sem wrapping
  [k: string]: any;
}
