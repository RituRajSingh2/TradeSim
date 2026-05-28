'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { useMarketHealthStore } from '@/stores/market-health-store';
import { useMarketSessionStore } from '@/stores/market-session-store';
import { apiPost } from '@/lib/api-client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import type { PlaceOrderRequest, OrderSide } from '@tradesim/shared';

interface OrderPanelProps {
  symbol: string;
  className?: string;
}

export function OrderPanel({ symbol, className }: OrderPanelProps) {
  const { quote } = useStockPrice(symbol);
  const { globalStaleness, isSimulated } = useMarketHealthStore();
  const { session } = useMarketSessionStore();
  const { executeOrderOptimistically, getEffectiveBuyingPower, getEffectiveHoldingQuantity } = usePortfolioStore();

  const [side, setSide] = useState<OrderSide>('BUY');
  const [quantity, setQuantity] = useState<string>('1');
  const [slippageTolerance, setSlippageTolerance] = useState<number>(0.02); // 2% default
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [executionSuccess, setExecutionSuccess] = useState(false);

  const lastPrice = quote?.ltp ?? 0;
  const numQuantity = parseInt(quantity, 10) || 0;
  const estimatedTotal = lastPrice * numQuantity;

  const isClosed = session === 'CLOSED' || session === 'WEEKEND';
  const isPreOpen = session === 'PREOPEN';

  const handleExecute = async () => {
    if (!quote || lastPrice <= 0) {
      setErrorMsg('Awaiting live price data...');
      return;
    }

    if (numQuantity <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }

    // Stale price check using global single source of truth
    if (globalStaleness === 'critical' || globalStaleness === 'expired') {
      setErrorMsg('Price data is critically stale. Trading blocked.');
      return;
    }
    
    if (isSimulated && session === 'OPEN') {
      setErrorMsg('Real trading is disabled while market data is simulated.');
      return;
    }

    setErrorMsg(null);
    setIsPending(true);

    const idempotencyKey = crypto.randomUUID();

    const orderPayload: Omit<PlaceOrderRequest, 'idempotencyKey'> = {
      symbol,
      side,
      type: 'MARKET',
      quantity: numQuantity,
      expectedPrice: lastPrice,
      slippageTolerance,
    };

    try {
      await executeOrderOptimistically(
        orderPayload,
        lastPrice,
        async (payload) => {
          // This fires the REST API while the UI is already updated instantly via the store.
          await apiPost('/orders', payload, {
            headers: {
              'X-Idempotency-Key': idempotencyKey
            }
          });
        }
      );
      
      // Inline success feedback
      setExecutionSuccess(true);
      setQuantity('1');
      
      setTimeout(() => {
        setExecutionSuccess(false);
      }, 2000);
      
    } catch (err: any) {
      if (err.message && err.message.includes('PRICE_MOVED')) {
        setErrorMsg('Price moved significantly. Please review the new price and try again.');
      } else if (err.message && err.message.includes('QUOTE_STALE')) {
        setErrorMsg('Market quote is stale. Waiting for fresh price...');
      } else {
        setErrorMsg(err.message || 'Order failed. Please try again.');
      }
    } finally {
      setIsPending(false);
    }
  };

  const effectiveBp = getEffectiveBuyingPower();
  const effectiveHolding = getEffectiveHoldingQuantity(symbol);

  // 2% Slippage buffer calculation for display
  const requiredBuyingPower = estimatedTotal * 1.02;
  const hasInsufficientFunds = side === 'BUY' && effectiveBp < requiredBuyingPower;
  const hasInsufficientHoldings = side === 'SELL' && effectiveHolding < numQuantity;

  return (
    <div className={cn("bg-bg-card border border-border-subtle rounded-xl p-4 flex flex-col h-full", className)}>
      <h3 className="font-semibold text-lg mb-4 text-text-primary">Order Entry</h3>
      
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => { setSide('BUY'); setErrorMsg(null); }}
          className={cn(
            "flex-1 h-10 rounded font-bold transition-colors",
            side === 'BUY' 
              ? "bg-positive/20 text-positive border border-positive/50" 
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
          )}
        >
          BUY
        </button>
        <button
          onClick={() => { setSide('SELL'); setErrorMsg(null); }}
          className={cn(
            "flex-1 h-10 rounded font-bold transition-colors",
            side === 'SELL' 
              ? "bg-negative/20 text-negative border border-negative/50" 
              : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
          )}
        >
          SELL
        </button>
      </div>

      <div className="space-y-4 mb-6">
        <div>
          <label className="text-xs text-text-secondary mb-1 block">Quantity</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full h-12 bg-bg-tertiary border border-border-primary rounded px-3 text-lg font-financial focus:border-accent outline-none"
            placeholder="0"
          />
        </div>

        <div className="flex justify-between items-center text-sm">
          <span className="text-text-secondary">Estimated Price</span>
          <span className="font-financial text-text-primary">
            {lastPrice > 0 ? `₹${lastPrice.toFixed(2)}` : '---'}
          </span>
        </div>

        <div className="flex justify-between items-center text-sm pt-2 border-t border-border-subtle">
          <span className="text-text-secondary font-medium">Total Cost</span>
          <span className="font-financial font-bold text-text-primary text-lg">
            {estimatedTotal > 0 ? `₹${estimatedTotal.toFixed(2)}` : '₹0.00'}
          </span>
        </div>
        
        <div className="flex justify-between items-center text-xs text-text-secondary pt-2">
          <span>Slippage Tolerance</span>
          <select 
            className="bg-bg-tertiary border border-border-subtle rounded px-1 outline-none"
            value={slippageTolerance}
            onChange={(e) => setSlippageTolerance(Number(e.target.value))}
          >
            <option value={0.005}>0.5%</option>
            <option value={0.01}>1.0%</option>
            <option value={0.02}>2.0%</option>
            <option value={0.05}>5.0%</option>
          </select>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-negative/10 border border-negative/20 rounded-lg text-sm text-negative">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-snug">{errorMsg}</p>
        </div>
      )}

      {isPreOpen && !errorMsg && !executionSuccess && (
        <div className="mb-4 p-3 bg-accent/10 border border-accent/20 rounded-lg text-sm text-text-primary font-medium">
          Market is in pre-open. Orders will simulate at market open.
        </div>
      )}

      <div className="mt-auto space-y-4">
        <div className="flex justify-between items-center text-xs text-text-secondary">
          <span>Available to trade:</span>
          <span className={cn("font-financial", hasInsufficientFunds && "text-negative")}>
            ₹{effectiveBp.toFixed(2)}
          </span>
        </div>
        
        {side === 'SELL' && (
          <div className="flex justify-between items-center text-xs text-text-secondary">
            <span>Available holdings:</span>
            <span className={cn("font-financial", hasInsufficientHoldings && "text-negative")}>
              {effectiveHolding} shares
            </span>
          </div>
        )}

        <button
          onClick={handleExecute}
          disabled={isPending || hasInsufficientFunds || hasInsufficientHoldings || lastPrice <= 0 || globalStaleness === 'critical' || globalStaleness === 'expired' || (isSimulated && session === 'OPEN') || isClosed || executionSuccess}
          className={cn(
            "w-full h-12 rounded font-bold text-bg-primary transition-all flex items-center justify-center",
            executionSuccess ? "bg-positive/20 text-positive border border-positive" :
            side === 'BUY' 
              ? "bg-positive hover:bg-positive/90" 
              : "bg-negative hover:bg-negative/90",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {executionSuccess ? (
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Order Executed
            </span>
          ) : isPending ? (
            <span className="animate-pulse">Processing...</span>
          ) : isClosed ? (
            'Market Closed'
          ) : side === 'BUY' ? (
             hasInsufficientFunds ? 'Insufficient Funds' : 'Execute Buy'
          ) : (
             hasInsufficientHoldings ? 'Insufficient Holdings' : 'Execute Sell'
          )}
        </button>
      </div>
    </div>
  );
}
