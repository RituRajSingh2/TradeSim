import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MarketService } from './market.service';
import { JwtAuthGuard } from '../../common/guards/auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('market')
@UseGuards(JwtAuthGuard)
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  /**
   * GET /api/market/quote/:symbol
   * Returns a single stock quote with live price data.
   */
  @Get('quote/:symbol')
  async getQuote(@Param('symbol') symbol: string) {
    return this.marketService.getQuote(symbol.toUpperCase());
  }

  /**
   * GET /api/market/ohlcv/:symbol?range=1mo
   * Returns OHLCV candlestick data for charting.
   */
  @Get('ohlcv/:symbol')
  async getOHLCV(
    @Param('symbol') symbol: string,
    @Query('range') range?: string,
  ) {
    return this.marketService.getOHLCV(symbol.toUpperCase(), range || '1mo');
  }

  /**
   * GET /api/market/search?query=reli
   * Search active market symbols by name or ticker.
   */
  @Get('search')
  async search(
    @Query('query') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketService.searchSymbols(
      query || '',
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /**
   * GET /api/market/status
   * Returns whether the market is currently open.
   */
  @Public()
  @Get('status')
  async getStatus() {
    return this.marketService.getMarketStatus();
  }

  /**
   * GET /api/market/trending?limit=10
   * Returns top movers sorted by absolute % change.
   */
  @Get('trending')
  async getTrending(@Query('limit') limit?: string) {
    return this.marketService.getTrending(
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
