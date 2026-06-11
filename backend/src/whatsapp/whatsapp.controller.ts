import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppWebhookService } from './webhook.service';
import { WahaWebhookDto } from './dto/waha-webhook.dto';


@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly webhookSecret: string;

  constructor(
    private readonly service: WhatsAppWebhookService,
    config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('WAHA_WEBHOOK_SECRET') ?? '';
  }

  /**
   * Webhook PÚBLICO chamado pela WAHA.
   * Para segurança mínima, validamos um header `x-webhook-secret` se
   * WAHA_WEBHOOK_SECRET estiver definido.
   */
  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook da WAHA — recebe mensagens entrantes' })
  async webhook(
    @Body() payload: WahaWebhookDto,
    @Headers('x-webhook-secret') incomingSecret?: string,
  ) {
    if (this.webhookSecret && incomingSecret !== this.webhookSecret) {
      return { ok: false, reason: 'invalid-secret' };
    }
    const result = await this.service.ingest(payload);
    return { ok: true, ...result };
  }
}