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
  private readonly makeWebhookUrl: string;

  constructor(
    private readonly service: WhatsAppWebhookService,
    config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('WAHA_WEBHOOK_SECRET') ?? '';
    this.makeWebhookUrl = config.get<string>('MAKE_WEBHOOK_URL') ?? '';
  }

  @Public()
  @Post('webhook')
  @ApiOperation({ summary: 'Webhook da WAHA — recebe mensagens entrantes' })
  async webhook(
    @Headers('x-webhook-secret') secret: string,
    @Body() payload: WahaWebhookDto,
  ) {
    if (this.webhookSecret && secret !== this.webhookSecret) {
      this.logger.warn(`Webhook rejeitado: recebido="${secret}" esperado="${this.webhookSecret}"`);
      throw new UnauthorizedException('invalid-secret');
    }
    this.logger.debug(`Webhook WAHA recebido: event=${payload?.event}`);
    const result = await this.service.ingest(payload);
    return { ok: true, ...result };
  }

  @Public()
  @Post('session-status')
  @ApiOperation({ summary: 'Webhook da WAHA — status da sessão (desconexão)' })
  async sessionStatus(@Body() payload: any) {
    const status: string = payload?.payload?.status ?? payload?.status ?? '';
    const session: string = payload?.session ?? 'default';

    this.logger.log(`Session status recebido: session=${session} status=${status}`);

    // Notifica o Make apenas em casos de falha/desconexão
    const alertStatuses = ['STOPPED', 'FAILED', 'SCAN_QR_CODE'];
    if (this.makeWebhookUrl && alertStatuses.includes(status.toUpperCase())) {
      try {
        // Busca o número conectado na sessão
        let connectedNumber = 'desconhecido';
        try {
          const wahaUrl = this.makeWebhookUrl && process.env.WAHA_URL;
          if (process.env.WAHA_URL) {
            const meRes = await fetch(
              `${process.env.WAHA_URL.replace(/\/$/, '')}/api/sessions/${session}/me`,
              { headers: { 'X-Api-Key': process.env.WAHA_API_KEY ?? '' } },
            );
            if (meRes.ok) {
              const me: any = await meRes.json();
              connectedNumber = me?.id?.replace('@c.us', '') ?? me?.phone ?? 'desconhecido';
            }
          }
        } catch (_) {}

        await fetch(this.makeWebhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nome: 'Gabriel Boldi',
            whatsapp: '+5527992788660',
            mensagem: `Sessão: ${session} | Número: ${connectedNumber} | Status: ${status}`,
          }),
        });
        this.logger.log(`Notificação enviada ao Make para status=${status}`);
      } catch (err) {
        this.logger.error(`Falha ao notificar Make: ${err}`);
      }
    }

    return { ok: true, status };
  }
}
