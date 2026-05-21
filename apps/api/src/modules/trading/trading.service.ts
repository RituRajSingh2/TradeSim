import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  NotAcceptableException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { LockingRepository } from '../../database/locking.repository';
import { LedgerRepository } from '../../database/ledger.repository';
import { MarketService } from '../market/market.service';
import { Prisma } from '@prisma/client';

// ============================================================
// Trading Service — Order Execution Engine
//
// Implements the BUY/SELL flows with:
//   - Pessimistic locking (SELECT FOR UPDATE on portfolio)
//   - Idempotent ledger entries (deterministic idempotencyKey)
//   - Atomic holding upsert with avgBuyPrice recalculation
//   - Full transactional consistency
// ============================================================

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly locking: LockingRepository,
    private readonly ledger: LedgerRepository,
    private readonly marketService: MarketService,
  ) {}

  /**
   * Validates that the market is currently open.
   * NSE hours: Mon-Fri 9:15 AM - 3:30 PM IST.
   * Throws BadRequestException if market is closed.
   */
  private assertMarketOpen() {
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000;
    const ist = new Date(now.getTime() + istOffset);

    const day = ist.getUTCDay(); // 0=Sun, 6=Sat
    const hours = ist.getUTCHours();
    const minutes = ist.getUTCMinutes();
    const timeMinutes = hours * 60 + minutes;

    const MARKET_OPEN = 9 * 60 + 15;
    const MARKET_CLOSE = 15 * 60 + 30;

    const isWeekday = day >= 1 && day <= 5;
    const isDuringHours = timeMinutes >= MARKET_OPEN && timeMinutes < MARKET_CLOSE;

    if (!isWeekday || !isDuringHours) {
      throw new BadRequestException(
        'Market is closed. NSE trading hours: Mon-Fri 9:15 AM - 3:30 PM IST.',
      );
    }
  }

  /**
   * Place a BUY order.
   *
   * Flow:
   * 0. Validate market is open
   * 1. Validate symbol exists and is active
   * 2. Fetch current market price
   * 3. Begin transaction with pessimistic lock
   * 4. Check sufficient balance
   * 5. Create order (EXECUTED)
   * 6. Debit balance via immutable ledger entry
   * 7. Upsert holding (create or increment)
   * 8. Update portfolio totals
   * 9. Commit
   */
  async placeBuyOrder(
    userId: string,
    symbol: string,
    quantity: number,
    idempotencyKey: string,
    expectedPrice: number,
    slippageTolerance: number,
  ) {
    // 0. Validate market hours
    this.assertMarketOpen();

    // 1. Validate symbol
    const marketSymbol = await this.prisma.marketSymbol.findFirst({
      where: { symbol, isActive: true },
    });
    if (!marketSymbol) {
      throw new NotFoundException(`Symbol ${symbol} not found or inactive`);
    }

    // 2. Begin transaction with pessimistic lock
    try {
      return await this.prisma.$transaction(async (tx) => {
      // 3. Lock portfolio
      const portfolio = await this.locking.lockPortfolio(tx, userId);

      // 4. Fetch current price (INSIDE LOCK)
      const quote = await this.marketService.getQuote(symbol);
      const price = quote.ltp;
      const quoteTime = quote.timestamp > 100000000000 ? quote.timestamp : quote.timestamp * 1000;
      
      // Validate freshness (max 5s old)
      if (Date.now() - quoteTime > 5000) {
        throw new NotAcceptableException('QUOTE_STALE: Market data is delayed. Please refresh.');
      }

      // Validate slippage
      const expectedPrice = arguments[4]; // expectedPrice from params
      const slippageTolerance = arguments[5]; // slippageTolerance from params
      
      const slippagePercent = Math.abs(price - expectedPrice) / expectedPrice;
      if (slippagePercent > slippageTolerance) {
        throw new NotAcceptableException(
          `PRICE_MOVED: Market price moved to ₹${price}. Please confirm new price.`
        );
      }

      const totalValue = +(price * quantity).toFixed(2);

      // 4. Check balance
      const currentBalance = Number(portfolio.balance);
      if (currentBalance < totalValue) {
        throw new BadRequestException(
          `Insufficient balance. Required: ₹${totalValue}, Available: ₹${currentBalance}`,
        );
      }

      // 5. Create order
      const order = await tx.order.create({
        data: {
          userId,
          symbolId: marketSymbol.id,
          symbol,
          companyName: quote.companyName,
          idempotencyKey,
          side: 'BUY',
          type: 'MARKET',
          quantity,
          price,
          totalValue,
          status: 'EXECUTED',
          expectedPrice: expectedPrice,
          slippagePercent: +slippagePercent.toFixed(4),
          quoteTimestamp: new Date(quoteTime),
          executedAt: new Date(),
        },
      });

      // 6. Debit balance via ledger
      const newBalance = +(currentBalance - totalValue).toFixed(2);
      await this.ledger.createEntry(tx, {
        userId,
        entryType: 'DEBIT',
        category: 'BUY_ORDER',
        amount: totalValue,
        runningBalance: newBalance,
        idempotencyKey: `buy_${order.id}`,
        orderId: order.id,
        description: `Buy ${quantity}x ${symbol} @ ₹${price}`,
      });

      // 7. Upsert holding
      const existingHolding = await tx.holding.findFirst({
        where: {
          portfolioId: portfolio.id,
          symbolId: marketSymbol.id,
          closedAt: null,
        },
      });

      if (existingHolding) {
        // Recalculate average buy price
        const oldTotalValue =
          Number(existingHolding.avgBuyPrice) * existingHolding.quantity;
        const newTotalBuyValue = oldTotalValue + totalValue;
        const newQuantity = existingHolding.quantity + quantity;
        const newAvgBuyPrice = +(newTotalBuyValue / newQuantity).toFixed(4);

        await tx.holding.update({
          where: { id: existingHolding.id },
          data: {
            quantity: newQuantity,
            avgBuyPrice: newAvgBuyPrice,
            totalBuyValue: +newTotalBuyValue.toFixed(2),
          },
        });
      } else {
        await tx.holding.create({
          data: {
            portfolioId: portfolio.id,
            symbolId: marketSymbol.id,
            symbol,
            companyName: quote.companyName,
            quantity,
            avgBuyPrice: price,
            totalBuyValue: totalValue,
          },
        });
      }

      // 8. Update portfolio
      const currentInvested = Number(portfolio.investedValue);
      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: {
          balance: newBalance,
          investedValue: +(currentInvested + totalValue).toFixed(2),
          version: { increment: 1 },
        },
      });

      this.logger.log(
        `BUY executed: ${userId} bought ${quantity}x ${symbol} @ ₹${price}`,
      );

      return {
        order: {
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          price: Number(order.price),
          totalValue: Number(order.totalValue),
          status: order.status,
          expectedPrice: expectedPrice,
          slippagePercent: +slippagePercent.toFixed(4),
          quoteTimestamp: new Date(quoteTime).toISOString(),
          executedAt: order.executedAt,
        },
        portfolio: {
          balance: newBalance,
          investedValue: +(currentInvested + totalValue).toFixed(2),
        },
      };
      }, { timeout: 10000, maxWait: 5000 });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
        this.logger.warn(`Idempotency trigger: Duplicate buy order caught for key ${idempotencyKey}`);
        
        // Replay-safe return
        const existingOrder = await this.prisma.order.findUnique({
          where: { idempotencyKey },
          include: { user: { include: { portfolio: true } } }
        });

        if (existingOrder && existingOrder.user.portfolio) {
          return {
            order: {
              id: existingOrder.id,
              symbol: existingOrder.symbol,
              side: existingOrder.side,
              quantity: existingOrder.quantity,
              price: Number(existingOrder.price),
              totalValue: Number(existingOrder.totalValue),
              status: existingOrder.status,
              executedAt: existingOrder.executedAt,
            },
            portfolio: {
              balance: Number(existingOrder.user.portfolio.balance),
              investedValue: Number(existingOrder.user.portfolio.investedValue),
            },
          };
        }
      }
      throw error;
    }
  }

  /**
   * Place a SELL order.
   *
   * Flow:
   * 1. Validate symbol + user holds sufficient quantity
   * 2. Fetch current market price
   * 3. Begin transaction with pessimistic lock
   * 4. Create order (EXECUTED)
   * 5. Credit balance via immutable ledger entry
   * 6. Update holding (decrement; close if quantity = 0)
   * 7. Update portfolio totals
   * 8. Commit
   */
  async placeSellOrder(
    userId: string,
    symbol: string,
    quantity: number,
    idempotencyKey: string,
    expectedPrice: number,
    slippageTolerance: number,
  ) {
    // 0. Validate market hours
    this.assertMarketOpen();

    // 1. Validate symbol
    const marketSymbol = await this.prisma.marketSymbol.findFirst({
      where: { symbol, isActive: true },
    });
    if (!marketSymbol) {
      throw new NotFoundException(`Symbol ${symbol} not found or inactive`);
    }

    // 2. Begin transaction with pessimistic lock
    try {
      return await this.prisma.$transaction(async (tx) => {
      // 3. Lock portfolio
      const portfolio = await this.locking.lockPortfolio(tx, userId);

      // 4. Fetch current price (INSIDE LOCK)
      const quote = await this.marketService.getQuote(symbol);
      const price = quote.ltp;
      const quoteTime = quote.timestamp > 100000000000 ? quote.timestamp : quote.timestamp * 1000;
      
      // Validate freshness (max 5s old)
      if (Date.now() - quoteTime > 5000) {
        throw new NotAcceptableException('QUOTE_STALE: Market data is delayed. Please refresh.');
      }

      // Validate slippage
      const expectedPrice = arguments[4]; // expectedPrice from params
      const slippageTolerance = arguments[5]; // slippageTolerance from params
      
      const slippagePercent = Math.abs(price - expectedPrice) / expectedPrice;
      if (slippagePercent > slippageTolerance) {
        throw new NotAcceptableException(
          `PRICE_MOVED: Market price moved to ₹${price}. Please confirm new price.`
        );
      }

      const totalValue = +(price * quantity).toFixed(2);

      // Verify holding exists and has sufficient quantity
      const holding = await tx.holding.findFirst({
        where: {
          portfolioId: portfolio.id,
          symbolId: marketSymbol.id,
          closedAt: null,
        },
      });

      if (!holding || holding.quantity < quantity) {
        throw new BadRequestException(
          `Insufficient holdings. You hold ${holding?.quantity || 0} shares of ${symbol}`,
        );
      }

      // 4. Create order
      const order = await tx.order.create({
        data: {
          userId,
          symbolId: marketSymbol.id,
          symbol,
          companyName: quote.companyName,
          idempotencyKey,
          side: 'SELL',
          type: 'MARKET',
          quantity,
          price,
          totalValue,
          status: 'EXECUTED',
          expectedPrice: expectedPrice,
          slippagePercent: +slippagePercent.toFixed(4),
          quoteTimestamp: new Date(quoteTime),
          executedAt: new Date(),
        },
      });

      // 5. Credit balance via ledger
      const currentBalance = Number(portfolio.balance);
      const newBalance = +(currentBalance + totalValue).toFixed(2);
      await this.ledger.createEntry(tx, {
        userId,
        entryType: 'CREDIT',
        category: 'SELL_ORDER',
        amount: totalValue,
        runningBalance: newBalance,
        idempotencyKey: `sell_${order.id}`,
        orderId: order.id,
        description: `Sell ${quantity}x ${symbol} @ ₹${price}`,
      });

      // 6. Update holding
      const newQuantity = holding.quantity - quantity;
      const proportionSold = quantity / holding.quantity;
      const soldBuyValue = +(Number(holding.totalBuyValue) * proportionSold).toFixed(2);
      
      const partialPnl = +(totalValue - soldBuyValue).toFixed(2);
      const newRealizedPnl = +(Number(holding.realizedPnl || 0) + partialPnl).toFixed(2);
      const newTotalExitValue = +(Number(holding.totalExitValue || 0) + totalValue).toFixed(2);

      if (newQuantity === 0) {
        // Close the holding
        const now = new Date();
        const durationMs = now.getTime() - holding.createdAt.getTime();

        await tx.holding.update({
          where: { id: holding.id },
          data: {
            quantity: 0,
            totalBuyValue: 0,
            closedAt: now,
            realizedPnl: newRealizedPnl,
            totalExitValue: newTotalExitValue,
            holdingDuration: durationMs,
          },
        });
      } else {
        await tx.holding.update({
          where: { id: holding.id },
          data: {
            quantity: newQuantity,
            totalBuyValue: +(Number(holding.totalBuyValue) - soldBuyValue).toFixed(2),
            realizedPnl: newRealizedPnl,
            totalExitValue: newTotalExitValue,
          },
        });
      }

      // 7. Update portfolio
      const currentInvested = Number(portfolio.investedValue);
      await tx.portfolio.update({
        where: { id: portfolio.id },
        data: {
          balance: newBalance,
          investedValue: +Math.max(0, currentInvested - soldBuyValue).toFixed(2),
          version: { increment: 1 },
        },
      });

      this.logger.log(
        `SELL executed: ${userId} sold ${quantity}x ${symbol} @ ₹${price}`,
      );

      return {
        order: {
          id: order.id,
          symbol: order.symbol,
          side: order.side,
          quantity: order.quantity,
          price: Number(order.price),
          totalValue: Number(order.totalValue),
          status: order.status,
          expectedPrice: expectedPrice,
          slippagePercent: +slippagePercent.toFixed(4),
          quoteTimestamp: new Date(quoteTime).toISOString(),
          executedAt: order.executedAt,
        },
        portfolio: {
          balance: newBalance,
          investedValue: +Math.max(0, currentInvested - soldBuyValue).toFixed(2),
        },
      };
      }, { timeout: 10000, maxWait: 5000 });
    } catch (error: any) {
      if (error.code === 'P2002' && error.meta?.target?.includes('idempotency_key')) {
        this.logger.warn(`Idempotency trigger: Duplicate sell order caught for key ${idempotencyKey}`);
        
        // Replay-safe return
        const existingOrder = await this.prisma.order.findUnique({
          where: { idempotencyKey },
          include: { user: { include: { portfolio: true } } }
        });

        if (existingOrder && existingOrder.user.portfolio) {
          return {
            order: {
              id: existingOrder.id,
              symbol: existingOrder.symbol,
              side: existingOrder.side,
              quantity: existingOrder.quantity,
              price: Number(existingOrder.price),
              totalValue: Number(existingOrder.totalValue),
              status: existingOrder.status,
              executedAt: existingOrder.executedAt,
            },
            portfolio: {
              balance: Number(existingOrder.user.portfolio.balance),
              investedValue: Number(existingOrder.user.portfolio.investedValue),
            },
          };
        }
      }
      throw error;
    }
  }

  /**
   * Get order history for a user (paginated, reverse chronological).
   */
  async getOrderHistory(
    userId: string,
    page = 1,
    pageSize = 20,
  ) {
    const where: Prisma.OrderWhereInput = { userId };

    const [items, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: items.map((o) => ({
        id: o.id,
        symbol: o.symbol,
        companyName: o.companyName,
        side: o.side,
        type: o.type,
        quantity: o.quantity,
        price: Number(o.price),
        totalValue: Number(o.totalValue),
        status: o.status,
        executedAt: o.executedAt?.toISOString() || null,
        createdAt: o.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      hasMore: page * pageSize < total,
    };
  }
}
