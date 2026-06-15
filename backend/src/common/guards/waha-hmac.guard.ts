import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

/**
 * Valida o webhook da WAHA via HMAC (substitui o antigo header
 * `x-webhook-secret`).
 *
 * A WAHA assina o CORPO BRUTO (raw body) da requisição usando o segredo
 * configurado em `WHATSAPP_HOOK_HMAC` (lado WAHA) e envia dois headers:
 *   - X-Webhook-Hmac            => assinatura em hexadecimal
 *   - X-Webhook-Hmac-Algorithm  => algoritmo usado (padrão: sha512)
 *
 * Aqui recalculamos o HMAC sobre o `req.rawBody` com `WAHA_HMAC_SECRET`
 * (que precisa ter o MESMO valor de `WHATSAPP_HOOK_HMAC`) e comparamos em
 * tempo constante.
 *
 * Se `WAHA_HMAC_SECRET` não estiver definido, a verificação é ignorada
 * (conveniente em desenvolvimento), mas registramos um aviso. Em produção,
 * sempre defina o segredo.
 */
@Injectable()
export class WahaHmacGuard implements CanActivate {
  private readonly logger = new Logger(WahaHmacGuard.name);
  private readonly secret: string;
  private readonly supportedAlgos = new Set(['sha512', 'sha256', 'sha1']);

  constructor(config: ConfigService) {
    this.secret = config.get<string>('WAHA_HMAC_SECRET') ?? '';
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.secret) {
      this.logger.warn(
        'WAHA_HMAC_SECRET não configurado — verificação de HMAC DESABILITADA. Defina-o em produção.',
      );
      return true;
    }

    const req = ctx
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();

    const rawBody = req.rawBody;
    if (!rawBody || rawBody.length === 0) {
      this.logger.warn('Webhook WAHA rejeitado: raw body ausente.');
      throw new UnauthorizedException('raw-body-missing');
    }

    const provided = this.headerValue(req.headers['x-webhook-hmac']);
    if (!provided) {
      this.logger.warn(
        'Webhook WAHA rejeitado: header X-Webhook-Hmac ausente.',
      );
      throw new UnauthorizedException('hmac-missing');
    }

    const algorithm =
      this.headerValue(req.headers['x-webhook-hmac-algorithm'])?.toLowerCase() ??
      'sha512';
    if (!this.supportedAlgos.has(algorithm)) {
      this.logger.warn(
        `Webhook WAHA rejeitado: algoritmo de HMAC não suportado "${algorithm}".`,
      );
      throw new UnauthorizedException('hmac-algorithm-unsupported');
    }

    const expected = createHmac(algorithm, this.secret)
      .update(rawBody)
      .digest('hex');

    if (!this.safeEqual(expected, provided)) {
      this.logger.warn('Webhook WAHA rejeitado: assinatura HMAC inválida.');
      throw new UnauthorizedException('invalid-hmac');
    }

    return true;
  }

  private headerValue(v: string | string[] | undefined): string | undefined {
    return Array.isArray(v) ? v[0] : v;
  }

  /**
   * Comparação em tempo constante das assinaturas hex (case-insensitive),
   * evitando timing attacks. Trata tamanhos diferentes sem lançar exceção.
   */
  private safeEqual(expectedHex: string, providedHex: string): boolean {
    const a = Buffer.from(expectedHex, 'utf8');
    const b = Buffer.from(providedHex.trim().toLowerCase(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
