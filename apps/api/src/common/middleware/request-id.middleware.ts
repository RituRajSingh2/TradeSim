import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { requestContext } from '../logger/logger.context';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Assigns a unique request ID to every incoming request.
 *
 * If the client sends an x-request-id header, it's preserved (useful
 * for tracing across load balancers/API gateways). Otherwise, a new
 * UUID is generated.
 *
 * The ID is attached to:
 * - req.id (for downstream handlers/services)
 * - response x-request-id header (for client correlation)
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request & { id?: string; user?: any }, res: Response, next: NextFunction) {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();

    req.id = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // Initialize context. User ID might not be available yet since this runs before AuthGuard,
    // but the context object is created and can be updated later in the request lifecycle if needed,
    // or just initialized here with requestId.
    const context = {
      requestId,
      // If user is already resolved somehow (e.g. JWT payload mapped early), store it.
      userId: req.user?.id || req.user?.sub || undefined,
    };

    requestContext.run(context, () => {
      next();
    });
  }
}
