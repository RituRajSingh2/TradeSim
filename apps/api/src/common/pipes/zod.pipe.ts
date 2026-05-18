import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod/v4';

/**
 * NestJS validation pipe that uses Zod schemas from @tradesim/shared.
 *
 * Usage in controllers:
 * ```ts
 * import { PlaceOrderRequestSchema } from '@tradesim/shared';
 *
 * @Post('orders')
 * placeOrder(@Body(new ZodPipe(PlaceOrderRequestSchema)) body: PlaceOrderRequest) {
 *   // body is validated and typed
 * }
 *
 * @Get('orders')
 * getOrders(@Query(new ZodPipe(OrderHistoryRequestSchema)) query: OrderHistoryRequest) {
 *   // query params are validated, coerced, and typed
 * }
 * ```
 */
@Injectable()
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      const error = result.error as ZodError;
      const formattedErrors = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw new BadRequestException({
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    return result.data;
  }
}
