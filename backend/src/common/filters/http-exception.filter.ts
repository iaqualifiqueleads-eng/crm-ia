import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly isProduction: boolean) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erro interno do servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as any;
        message = r.message ?? message;
        error = r.error ?? error;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // P2002 = unique constraint
      if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        message = 'Registro duplicado';
        error = 'Conflict';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'Registro não encontrado';
        error = 'Not Found';
      } else {
        status = HttpStatus.BAD_REQUEST;
        message = 'Erro de banco de dados';
        error = 'Bad Request';
      }
    }

    // Log completo — somente no servidor
    this.logger.error(
      `${request.method} ${request.url} -> ${status} :: ${JSON.stringify(message)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(status).json({
      statusCode: status,
      error,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(this.isProduction ? {} : { detail: exception instanceof Error ? exception.message : undefined }),
    });
  }
}
