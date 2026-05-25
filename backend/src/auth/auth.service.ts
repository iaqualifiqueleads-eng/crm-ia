import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, AuthResponseDto, ChangePasswordDto } from './dto/auth.dto';
import { CurrentUserPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto, meta: { userAgent?: string; ipAddress?: string }): Promise<AuthResponseDto> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, deletedAt: null },
    });

    if (!user) {
      // Mensagem genérica — não revela se o e-mail existe
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Usuário inativo');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return this.issueTokens(
      { sub: user.id, email: user.email, role: user.role, supervisorId: user.supervisorId },
      meta,
    );
  }

  async refresh(refreshToken: string, meta: { userAgent?: string; ipAddress?: string }): Promise<AuthResponseDto> {
    let payload: any;
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }

    // Procura o token no banco — precisa estar ativo (não revogado, não expirado)
    const tokenHash = await this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        userId: payload.sub,
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Refresh token revogado ou desconhecido');
    }

    // Rotaciona — revoga o atual e emite novo par
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, isActive: true, deletedAt: null },
    });
    if (!user) {
      throw new UnauthorizedException('Usuário inválido');
    }

    return this.issueTokens(
      { sub: user.id, email: user.email, role: user.role, supervisorId: user.supervisorId },
      meta,
    );
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    if (!refreshToken) return { success: true };
    const tokenHash = await this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Senha atual incorreta');

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('A nova senha deve ser diferente da atual');
    }

    const rounds = this.config.get<number>('BCRYPT_SALT_ROUNDS', 12);
    const passwordHash = await bcrypt.hash(dto.newPassword, rounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Revoga todos os refresh tokens do usuário — força re-login em outros dispositivos
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  // --------------------------------------------------------
  // Helpers internos
  // --------------------------------------------------------

  private async issueTokens(
    payload: CurrentUserPayload,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthResponseDto> {
    const accessToken = await this.jwt.signAsync(
      { sub: payload.sub, email: payload.email, role: payload.role },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.getOrThrow<string>('JWT_ACCESS_EXPIRES_IN'),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: payload.sub, email: payload.email, role: payload.role },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.getOrThrow<string>('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    const tokenHash = await this.hashToken(refreshToken);
    // Calcula expiração — sem fazer parse manual: decodifica o próprio JWT
    const decoded: any = this.jwt.decode(refreshToken);
    const expiresAt = new Date(decoded.exp * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: payload.sub,
        tokenHash,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ipAddress?.slice(0, 50),
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, supervisorId: true },
    });

    return {
      accessToken,
      refreshToken,
      user: user!,
    };
  }

  private async hashToken(token: string): Promise<string> {
    // SHA-256 determinístico — permite lookup do refresh token no banco
    // sem armazenar o token em claro. Inclui o JWT_REFRESH_SECRET como pepper.
    const pepper = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    return createHash('sha256').update(`${pepper}.${token}`).digest('hex');
  }
}
