import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@crm.local' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: 'ChangeMe@123', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class AuthResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    supervisorId: string | null;
  };
}

/**
 * Não expomos um endpoint público de "register".
 * Usuários são criados pelo MANAGER ou SUPERVISOR através de POST /users.
 * O gerente inicial é criado pelo seed.
 */
export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @MaxLength(72, { message: 'Senha muito longa' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'A senha deve conter letras e números',
  })
  newPassword: string;
}
