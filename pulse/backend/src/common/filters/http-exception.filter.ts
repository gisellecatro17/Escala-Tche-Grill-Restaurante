import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { ApiErrorResponse } from '../types/api-response';

const DEFAULT_ERROR_MESSAGE = 'Não foi possível realizar a operação.';
const INTERNAL_SERVER_ERROR_STATUS: number = HttpStatus.INTERNAL_SERVER_ERROR;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status: number =
      exception instanceof HttpException
        ? exception.getStatus()
        : INTERNAL_SERVER_ERROR_STATUS;

    const { message, errors } = this.extractMessageAndErrors(exception);

    if (status >= INTERNAL_SERVER_ERROR_STATUS) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        (exception as Error)?.stack,
      );
    }

    const body: ApiErrorResponse = {
      success: false,
      message,
      errors,
    };

    response.status(status).json(body);
  }

  private extractMessageAndErrors(exception: unknown): {
    message: string;
    errors: string[];
  } {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return { message: response, errors: [] };
      }

      if (typeof response === 'object' && response !== null) {
        const body = response as {
          message?: string | string[];
          error?: string;
        };

        if (Array.isArray(body.message)) {
          return { message: 'Existem campos inválidos.', errors: body.message };
        }

        return {
          message: body.message ?? body.error ?? exception.message,
          errors: [],
        };
      }

      return { message: exception.message, errors: [] };
    }

    return { message: DEFAULT_ERROR_MESSAGE, errors: [] };
  }
}
