import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { PlatformLogger } from '../../common/logger/logger.service';

/**
 * Interceptor that emits structured audit logs for every admin endpoint access.
 * Applied to all /api/admin/* routes.
 *
 * Logs: admin userId, endpoint, method, IP address, response time.
 */
@Injectable()
export class AdminAuditInterceptor implements NestInterceptor {
  constructor(private readonly logger: PlatformLogger) {
    this.logger.setContext('AdminAudit');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const elapsed = Date.now() - startTime;
          this.logger.log({
            message: `Admin access: ${request.method} ${request.url}`,
            eventType: 'ADMIN_ACCESS',
            metadata: {
              adminUserId: user?.sub || 'unknown',
              method: request.method,
              path: request.url,
              ip: request.ip || request.headers['x-forwarded-for'] || 'unknown',
              durationMs: elapsed,
              statusCode: context.switchToHttp().getResponse().statusCode,
            },
          });
        },
        error: (error) => {
          const elapsed = Date.now() - startTime;
          this.logger.warn({
            message: `Admin access failed: ${request.method} ${request.url}`,
            eventType: 'ADMIN_ACCESS_FAILED',
            metadata: {
              adminUserId: user?.sub || 'unknown',
              method: request.method,
              path: request.url,
              ip: request.ip || request.headers['x-forwarded-for'] || 'unknown',
              durationMs: elapsed,
              error: error?.message || String(error),
            },
          });
        },
      }),
    );
  }
}
