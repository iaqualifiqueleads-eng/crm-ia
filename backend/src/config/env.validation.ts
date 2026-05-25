import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsString, MinLength, validateSync } from 'class-validator';

enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvVars {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsNumber()
  PORT: number;

  @IsString()
  FRONTEND_URL: string;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_HOST: string;

  @IsNumber()
  REDIS_PORT: number;

  @IsString()
  @MinLength(16, { message: 'JWT_ACCESS_SECRET precisa de ao menos 16 caracteres' })
  JWT_ACCESS_SECRET: string;

  @IsString()
  JWT_ACCESS_EXPIRES_IN: string;

  @IsString()
  @MinLength(16, { message: 'JWT_REFRESH_SECRET precisa de ao menos 16 caracteres' })
  JWT_REFRESH_SECRET: string;

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string;

  @IsNumber()
  BCRYPT_SALT_ROUNDS: number;
}

export function envValidation(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvVars, config, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .map((e) => Object.values(e.constraints || {}).join('; '))
      .join(' | ');
    throw new Error(`Variáveis de ambiente inválidas: ${messages}`);
  }
  return validated;
}
