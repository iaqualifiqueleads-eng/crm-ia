import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppWebhookService } from './webhook.service';
import { WahaWebhookDto } from './dto/waha-webhook.dto';
import { WahaHmacGuard } from './guards/waha-hmac.guard';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);

  constructor(private readonly service: WhatsAppWebhookService) {}

  /**
   * Webhook PÚBLICO chamado pela WAHA.
   *
   * A autenticidade é garantida pelo `WahaHmacGuard`, que valida a assinatura
   * HMAC-SHA512 do corpo bruto (headers `X-Webhook-Hmac` /
   * `X-Webhook-Hmac-Algorithm`). Não usamos mais `x-webhook-secret`.
   */
  @Public()
  @UseGuards(WahaHmacGuard)
  @Post('webhook')
  @ApiOperation({
    summary: 'Webhook da WAHA — recebe mensagens entrantes (validado via HMAC)',
  })
  async webhook(@Body() payload: WahaWebhookDto) {
    this.logger.debug(`Webhook WAHA recebido: event=${payload?.event}`);
    const result = await this.service.ingest(payload);
    return { ok: true, ...result };
  }
}
