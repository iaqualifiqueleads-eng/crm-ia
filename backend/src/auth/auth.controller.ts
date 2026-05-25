import { Body, Controller, Post, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto, RefreshTokenDto, AuthResponseDto, ChangePasswordDto } from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../common/decorators/current-user.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Login com e-mail e senha' })
  @ApiResponse({ status: 200, type: AuthResponseDto })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.login(dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  @ApiOperation({ summary: 'Renova access token usando refresh token' })
  async refresh(@Body() dto: RefreshTokenDto, @Req() req: Request): Promise<AuthResponseDto> {
    return this.authService.refresh(dto.refreshToken, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Revoga o refresh token' })
  async logout(@Body() dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Altera a senha do usuário logado' })
  async changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.sub, dto);
  }
}
