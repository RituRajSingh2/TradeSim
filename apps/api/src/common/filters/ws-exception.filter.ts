import { Catch, ArgumentsHost, WsExceptionFilter as INestWsExceptionFilter } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { PlatformLogger } from '../logger/logger.service';

/**
 * Catches exceptions thrown in WebSocket gateways and logs them as structured JSON.
 * Returns a standardized error payload to the client.
 */
@Catch()
export class WsExceptionFilter implements INestWsExceptionFilter {
  private readonly logger = new PlatformLogger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToWs();
    const client = ctx.getClient<Socket>();
    const data = ctx.getData();
    
    // Attempt to extract the event name from the pattern if possible
    // (NestJS doesn't directly expose this easily in the filter without reflection)
    const eventName = 'unknown_event';

    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof WsException) {
      const exceptionError = exception.getError();
      if (typeof exceptionError === 'string') {
        message = exceptionError;
      } else if (typeof exceptionError === 'object' && exceptionError !== null) {
        message = (exceptionError as any).message || message;
        code = (exceptionError as any).code || code;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    const userId = client.data?.userId || 'unknown';

    this.logger.error({
      message: `WebSocket error in ${eventName}: ${message}`,
      eventType: 'WS_EXCEPTION',
      metadata: {
        socketId: client.id,
        userId,
        event: eventName,
        data,
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      },
    });

    // Send the error back to the client
    client.emit('error', {
      success: false,
      error: {
        code,
        message,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
