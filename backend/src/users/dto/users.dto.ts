import { ApiProperty, ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Ariany Vieira' })
  @IsString()
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'ariany@empresa.com' })
  @IsEmail()
  @MaxLength(191)
  email: string;

  @ApiProperty({ minLength: 8, example: 'Senha@1234' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'A senha deve conter letras e números' })
  password: string;

  @ApiProperty({ enum: UserRole, example: UserRole.SALESPERSON })
  @IsEnum(UserRole)
  role: UserRole;

  @ApiPropertyOptional({
    description:
      'ID do supervisor direto. Obrigatório para SALESPERSON e SUPERVISOR. Se omitido para SALESPERSON, será atribuído ao gerente ou ao supervisor que cria.',
  })
  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'email'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ResetUserPasswordDto {
  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'A senha deve conter letras e números' })
  newPassword: string;
}
