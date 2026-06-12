import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // Prefixo global
  app.setGlobalPrefix('api');

  // Validação global — class-validator + class-transformer
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // remove propriedades não declaradas no DTO
      forbidNonWhitelisted: true, // rejeita se vierem props extras
      transform: true,           // transforma payloads para instâncias das classes DTO
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filtro global de exceções — não vaza stack trace em produção
  app.useGlobalFilters(new HttpExceptionFilter(nodeEnv === 'production'));

  // CORS — apenas frontend
  app.enableCors({
    origin: frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // Swagger — só em dev
  // if (nodeEnv !== 'production') {
  //   const swaggerConfig = new DocumentBuilder()
  //     .setTitle('CRM B2B — API')
  //     .setDescription('CRM para gestão de carteira B2B com previsão de recompra')
  //     .setVersion('0.1.0')
  //     .addBearerAuth(
  //       { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
  //       'access-token',
  //     )
  //     .build();
  //   const document = SwaggerModule.createDocument(app, swaggerConfig);
  //   SwaggerModule.setup('api/docs', app, document, {
  //     swaggerOptions: { persistAuthorization: true },
  //   });
  //   Logger.log(`Swagger disponível em http://localhost:${port}/api/docs`, 'Bootstrap');
  // }

  await app.listen(port);
  Logger.log(`API rodando em http://localhost:${port}/api`, 'Bootstrap');
}

bootstrap();
