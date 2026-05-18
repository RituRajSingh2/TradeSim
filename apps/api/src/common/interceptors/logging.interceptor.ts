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
          this.logger.log(`${method} ${url} ${statusCode} — ${elapsed}ms`);
        },
        error: (error) => {
          const elapsed = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ${error?.status || 500} — ${elapsed}ms`,
          );
        },
      }),
    );
  }
}
