import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = ctx.getResponse();
          const statusCode = response.statusCode;
          const elapsed = Date.now() - startTime;
          this.logger.log({
            message: `${method} ${url} ${statusCode}`,
            eventType: 'HTTP_RESPONSE',
            metadata: {
              statusCode,
              method,
              path: url,
              durationMs: elapsed,
            },
          });
        },
        error: (error) => {
          const elapsed = Date.now() - startTime;
          // The HttpExceptionFilter handles the actual error trace,
          // but we log the response time metric here.
          this.logger.warn({
            message: `${method} ${url} ${error?.status || 500}`,
            eventType: 'HTTP_RESPONSE_ERROR',
            metadata: {
              statusCode: error?.status || 500,
              method,
              path: url,
              durationMs: elapsed,
            },
          });
        },
      }),
    );
  }
}
