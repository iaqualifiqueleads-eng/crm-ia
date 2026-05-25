import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

interface JwtRawPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  async validate(payload: JwtRawPayload): Promise<CurrentUserPayload> {
    // Revalida o usuário a cada request — protege contra contas desativadas
    // ou deletadas mesmo com token ainda dentro da validade.
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
      select: { id: true, email: true, role: true, supervisorId: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário inválido ou inativo');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      supervisorId: user.supervisorId,
    };
  }
}
