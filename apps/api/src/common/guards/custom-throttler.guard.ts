import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { PlatformLogger } from '../logger/logger.service';
import { Request } from 'express';
import { PlatformEvent } from '@tradesim/shared';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly platformLogger = new PlatformLogger('ThrottlerGuard');

  protected async throwThrottlingException(context: ExecutionContext): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>();
    
    this.platformLogger.warn({
      eventType: PlatformEvent.RATE_LIMIT_EXCEEDED,
      message: `Rate limit exceeded for IP: ${req.ip} on ${req.method} ${req.url}`,
      metadata: {
        ip: req.ip,
        method: req.method,
        path: req.url,
        userId: (req as any).user?.sub || (req as any).user?.id || undefined,
      }
    });

    throw new ThrottlerException('Too many requests, please try again later.');
  }
}
