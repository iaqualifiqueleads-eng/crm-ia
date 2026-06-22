import { Body, Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/decorators/public.decorator';
import { WhatsAppWebhookService } from './webhook.service';
import { WahaWebhookDto } from './dto/waha-webhook.dto';

@ApiTags('WhatsApp')
@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly service: WhatsAppWebhookService,
    config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('WAHA_WEBHOOK_SECRET') ?? '';
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook da WAHA — recebe mensagens entrantes' })
  async webhook(
    @Headers('x-webhook-secret') secret: string,
    @Body() payload: WahaWebhookDto,
  ) {
    if (this.webhookSecret && secret !== this.webhookSecret) {
      this.logger.warn('Webhook rejeitado: x-webhook-secret inválido');
      throw new UnauthorizedException('invalid-secret');
    }
    this.logger.debug(`Webhook WAHA recebido: event=${payload?.event}`);
    const result = await this.service.ingest(payload);
    return { ok: true, ...result };
  }
}
