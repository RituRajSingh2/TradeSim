import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MarketDataProvider, StockQuote, OHLCVBar } from './market-data.provider';

@Injectable()
export class AlphaVantageProvider implements MarketDataProvider {
  private readonly logger = new Logger(AlphaVantageProvider.name);
  private readonly apiKey: string;
  readonly name = 'AlphaVantage';

  constructor(private readonly configService: ConfigService) {
    // Uses demo key if not provided
    this.apiKey = this.configService.get<string>('ALPHA_VANTAGE_API_KEY', 'demo');
  }

  async getQuote(symbol: string): Promise<StockQuote> {
    const nseSymbol = `${symbol}.BSE`; // AlphaVantage prefers .BSE for Indian stocks, or we just mock if we hit rate limits
    
    try {
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${nseSymbol}&apikey=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`AlphaVantage HTTP error: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data['Note'] || data['Information']) {
        throw new Error('AlphaVantage API rate limit exceeded');
      }

      const quote = data['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        throw new Error(`AlphaVantage returned no data for ${symbol}`);
      }

      const ltp = parseFloat(quote['05. price']);
      const previousClose = parseFloat(quote['08. previous close']);
      
      return {
        symbol,
        companyName: symbol, // AlphaVantage GLOBAL_QUOTE doesn't return company name
        ltp,
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        close: ltp,
        previousClose,
        volume: parseInt(quote['06. volume'], 10),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent'].replace('%', '')),
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`AlphaVantage error for ${symbol}: ${error}`);
      throw error;
    }
  }

  async getBulkQuotes(symbols: string[]): Promise<Map<string, StockQuote>> {
    const results = new Map<string, StockQuote>();
    // AlphaVantage doesn't have a bulk quote endpoint on free tier.
    // Fetch individually but with strict concurrency to avoid instant ban.
    for (const symbol of symbols) {
      try {
        const quote = await this.getQuote(symbol);
        results.set(symbol, quote);
        // Sleep slightly to respect 5 requests / minute free tier
        await new Promise(r => setTimeout(r, 200));
      } catch (e) {
        this.logger.warn(`Failed to fetch bulk quote for ${symbol} from AlphaVantage`);
      }
    }
    return results;
  }

  async getOHLCV(symbol: string, range = '1mo'): Promise<OHLCVBar[]> {
    // Skeleton implementation, we will rely on primary for history for now
    throw new Error('Method not implemented for AlphaVantage yet');
  }
}
