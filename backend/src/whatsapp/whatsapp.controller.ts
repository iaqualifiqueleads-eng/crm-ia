import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppWebhookService } from './webhook.service';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly webhookSecret: string;

  constructor(
    private readonly service: WhatsAppWebhookService,
    config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('EVOLUTION_WEBHOOK_SECRET') ?? '';
  }

  /**
   * Webhook PÚBLICO chamado pela Evolution.
   * Para segurança mínima, validamos um header `x-webhook-secret` se
   * EVOLUTION_WEBHOOK_SECRET estiver definido.
   */
  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook da Evolution API — recebe mensagens entrantes' })
  async webhook(
    @Body() payload: any,
    @Headers('x-webhook-secret') incomingSecret?: string,
  ) {
    if (this.webhookSecret && incomingSecret !== this.webhookSecret) {
      return { ok: false, reason: 'invalid-secret' };
    }
    const result = await this.service.ingest(payload);
    return { ok: true, ...result };
  }
}
