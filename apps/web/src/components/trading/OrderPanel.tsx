'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { apiPost } from '@/lib/api-client';
import type { PlaceOrderRequest, OrderSide } from '@tradesim/shared';

interface OrderPanelProps {
  symbol: string;
  className?: string;
}

export function OrderPanel({ symbol, className }: OrderPanelProps) {
  const { quote, isStale } = useStockPrice(symbol);
  const { executeOrderOptimistically, getEffectiveBuyingPower, getEffectiveHoldingQuantity } = usePortfolioStore();

  const [side, setSide] = useState<OrderSide>('BUY');
  const [quantity, setQuantity] = useState<string>('1');
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const lastPrice = quote?.ltp ?? 0;
  const numQuantity = parseInt(quantity, 10) || 0;
  const estimatedTotal = lastPrice * numQuantity;

  const handleExecute = async () => {
    if (!quote || lastPrice <= 0) {
      setErrorMsg('Awaiting live price data...');
      return;
    }

    if (numQuantity <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }

    // Stale price check (reject if tick is older than 5000ms)
    const now = Date.now();
    if (isStale || (now - quote.timestamp > 5000)) {
      setErrorMsg('Price data is stale (> 5s). Market orders blocked.');
      return;
    }

    setErrorMsg(null);
    setIsPending(true);

    const orderPayload: Omit<PlaceOrderRequest, 'idempotencyKey'> = {
      symbol,
      side,
      type: 'MARKET',
      quantity: numQuantity,
    };

    try {
      await executeOrderOptimistically(
        orderPayload,
        lastPrice,
        async (payload) => {
          // This fires the REST API while the UI is already updated instantly via the store.
          await apiPost('/orders', payload);
        }
      );
      // Reset form on success (optimistic UI is already showing success state)
      setQuantity('1');
    } catch (err: any) {
      setErrorMsg(err.message || 'Order failed. Please try again.');
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
          onClick={() => setSide('BUY')}
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
          onClick={() => setSide('SELL')}
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
      </div>

      {errorMsg && (
        <div className="mb-4 p-3 rounded bg-negative/10 border border-negative/20 text-negative text-sm">
          {errorMsg}
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
          disabled={isPending || hasInsufficientFunds || hasInsufficientHoldings || lastPrice <= 0}
          className={cn(
            "w-full h-12 rounded font-bold text-bg-primary transition-colors flex items-center justify-center",
            side === 'BUY' 
              ? "bg-positive hover:bg-positive/90" 
              : "bg-negative hover:bg-negative/90",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isPending ? (
            <span className="animate-pulse">Processing...</span>
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
