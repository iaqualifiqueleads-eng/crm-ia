import { Body, Controller, Get, Headers, Logger, Post, Query, UnauthorizedException } from '@nestjs/common';
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
  private readonly replayAgentWebhookUrl: string;
  private readonly wahaUrl: string;
  private readonly wahaApiKey: string;

  constructor(
    private readonly service: WhatsAppWebhookService,
    config: ConfigService,
  ) {
    this.webhookSecret = config.get<string>('WAHA_WEBHOOK_SECRET') ?? '';
    this.replayAgentWebhookUrl = config.get<string>('REPLAY_AGENTE_NOTIFICAR_INSTANCIA_WEBHOOK_URL') ?? '';
    this.wahaUrl = (config.get<string>('WAHA_URL') ?? '').replace(/\/$/, '');
    this.wahaApiKey = config.get<string>('WAHA_API_KEY') ?? '';
  }

  @Get('check-number')
  @ApiOperation({ summary: 'Verifica se um número tem WhatsApp' })
  async checkNumber(@Query('phone') phone: string) {
    console.log('[phone] => ', phone);
    console.log('[encodeURIComponent(phone)] => ', encodeURIComponent(phone));

    if (!phone) return { numberExists: false };

    try {
      const res = await fetch(
        `${this.wahaUrl}/api/contacts/check-exists?phone=${encodeURIComponent(phone)}&session=default`,
        { headers: { 'X-Api-Key': this.wahaApiKey } },
      );

      console.log('[res] => ', `${res.ok}`);

      if (!res.ok) return { numberExists: false };
      const data: any = await res.json();

      console.log('[data] => ', `${data}`);

      return { numberExists: !!data?.numberExists };
    } catch {
      return { numberExists: false };
    }
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

    // Notifica o Replay Agent apenas em casos de falha/desconexão
    const alertStatuses = ['STOPPED', 'FAILED', 'SCAN_QR_CODE'];
    if (this.replayAgentWebhookUrl && alertStatuses.includes(status.toUpperCase())) {
      try {
        // Busca o número conectado na sessão
        let connectedNumber = 'desconhecido';
        try {
          const wahaUrl = this.replayAgentWebhookUrl && process.env.WAHA_URL;
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
        } catch (_) { }

        await fetch(this.replayAgentWebhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            nome: 'Gabriel Boldi',
            whatsapp: '+5527992788660',
            mensagem: `⚠️❌ Sessão: ${session} | Número: ${connectedNumber} | Status: ${status}`,
          }),
        });
        this.logger.log(`Notificação enviada ao Replay Agent para status=${status}`);
      } catch (err) {
        this.logger.error(`Falha ao notificar Replay Agent: ${err}`);
      }
    }

    return { ok: true, status };
  }
}
