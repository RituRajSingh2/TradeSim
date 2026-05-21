import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { TradingService } from './trading.service';
import { JwtAuthGuard, type JwtPayload } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodPipe } from '../../common/pipes/zod.pipe';
import { PlaceOrderRequestSchema, type PlaceOrderRequest } from '@tradesim/shared';

@Controller('trading')
@UseGuards(JwtAuthGuard)
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  /**
   * POST /api/trading/orders
   * Place a market order (BUY or SELL).
   */
  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  async placeOrder(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodPipe(PlaceOrderRequestSchema)) body: PlaceOrderRequest,
    @Headers('x-idempotency-key') idempotencyKey: string,
  ) {
    if (!idempotencyKey) {
      throw new BadRequestException('x-idempotency-key header is required to prevent double-execution');
    }

    if (body.side === 'BUY') {
      return this.tradingService.placeBuyOrder(
        user.sub,
        body.symbol,
        body.quantity,
        idempotencyKey,
        body.expectedPrice,
        body.slippageTolerance,
      );
    }

    return this.tradingService.placeSellOrder(
      user.sub,
      body.symbol,
      body.quantity,
      idempotencyKey,
      body.expectedPrice,
      body.slippageTolerance,
    );
  }

  /**
   * GET /api/trading/orders?page=1&pageSize=20
   * Get order history (paginated).
   */
  @Get('orders')
  async getOrders(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.tradingService.getOrderHistory(
      user.sub,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }
}
