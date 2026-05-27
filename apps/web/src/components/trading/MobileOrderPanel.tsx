'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStockPrice } from '@/lib/websocket/use-stock-price';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { useAuthStore } from '@/stores/auth-store';
import { apiPost } from '@/lib/api-client';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { OrderSide, PlaceOrderRequest } from '@tradesim/shared';
import { formatCurrency } from '@tradesim/shared';

export function MobileOrderPanel({ symbol }: { symbol: string }) {
  const { quote } = useStockPrice(symbol);
  const { executeOrderOptimistically, getEffectiveBuyingPower, getEffectiveHoldingQuantity } = usePortfolioStore();
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  const [side, setSide] = useState<OrderSide>('BUY');
  const [quantity, setQuantity] = useState<string>('');
  const [showReview, setShowReview] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const lastPrice = quote?.ltp ?? 0;
  const numQty = parseInt(quantity, 10) || 0;
  const estimatedTotal = lastPrice * numQty;
  const effectiveBp = getEffectiveBuyingPower();
  const effectiveHolding = getEffectiveHoldingQuantity(symbol);

  // Buffer used internally for market orders but hidden from user
  const slippageTolerance = 0.02; 
  const requiredBuyingPower = estimatedTotal * (1 + slippageTolerance);
  
  const hasInsufficientFunds = side === 'BUY' && effectiveBp < requiredBuyingPower;
  const hasInsufficientHoldings = side === 'SELL' && effectiveHolding < numQty;
  const isInvalidQty = numQty <= 0;

  const handleReviewClick = () => {
    if (!isAuthenticated) {
      router.push('/login?returnTo=/trade/' + symbol);
      return;
    }
    if (isInvalidQty || hasInsufficientFunds || hasInsufficientHoldings || lastPrice <= 0) return;
    setShowReview(true);
  };

  const handleExecute = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    
    const idempotencyKey = crypto.randomUUID();
    const orderPayload: Omit<PlaceOrderRequest, 'idempotencyKey'> = {
      symbol,
      side,
      type: 'MARKET',
      quantity: numQty,
      expectedPrice: lastPrice,
      slippageTolerance,
    };

    try {
      await executeOrderOptimistically(
        orderPayload,
        lastPrice,
        async (payload) => {
          await apiPost('/orders', payload, { headers: { 'X-Idempotency-Key': idempotencyKey }});
        }
      );
      toast.success(`${side === 'BUY' ? 'Bought' : 'Sold'} ${numQty} shares of ${symbol}`);
      setQuantity('');
      setShowReview(false);
    } catch (err: any) {
      toast.error(err.message || 'Order failed. Please try again.');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      {/* Sticky Bottom Container */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-primary border-t border-border-subtle px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex flex-1 p-1 bg-bg-secondary rounded-lg">
            <button
              onClick={() => setSide('BUY')}
              className={cn(
                "flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors",
                side === 'BUY' ? "bg-bg-primary text-positive shadow-sm" : "text-text-muted"
              )}
            >
              BUY
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={cn(
                "flex-1 py-1.5 text-sm font-semibold rounded-md transition-colors",
                side === 'SELL' ? "bg-bg-primary text-negative shadow-sm" : "text-text-muted"
              )}
            >
              SELL
            </button>
          </div>
          <div className="flex-1">
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Qty"
              className="w-full h-9 bg-bg-secondary border border-transparent rounded-lg px-3 text-sm font-semibold text-text-primary text-center focus:border-accent outline-none placeholder:text-text-muted placeholder:font-normal"
            />
          </div>
        </div>

        <button
          onClick={handleReviewClick}
          disabled={(isInvalidQty || hasInsufficientFunds || hasInsufficientHoldings || lastPrice <= 0) && isAuthenticated}
          className={cn(
            "w-full h-12 rounded-lg font-bold text-bg-primary transition-colors flex items-center justify-center text-[15px]",
            !isAuthenticated ? "bg-accent active:bg-accent-hover" : (side === 'BUY' ? "bg-positive active:bg-positive/80" : "bg-negative active:bg-negative/80"),
            "disabled:opacity-40 disabled:bg-bg-tertiary disabled:text-text-muted"
          )}
        >
          {!isAuthenticated ? 'Login to Trade' : (side === 'BUY' ? 'Review Buy Order' : 'Review Sell Order')}
        </button>
      </div>

      {/* Review Sheet Modal */}
      {showReview && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={() => !isExecuting && setShowReview(false)} />
          <div className="relative bg-bg-primary rounded-t-2xl px-6 pt-2 pb-[max(24px,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-full duration-150 ease-out">
            <div className="w-10 h-1.5 bg-border-subtle rounded-full mx-auto mb-5" />
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">Review Order</h2>
              <button disabled={isExecuting} onClick={() => setShowReview(false)} className="p-2 -mr-2 text-text-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                <span className="text-text-secondary font-medium">Action</span>
                <span className={cn("font-bold", side === 'BUY' ? "text-positive" : "text-negative")}>
                  {side} {symbol}
                </span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                <span className="text-text-secondary font-medium">Quantity</span>
                <span className="font-bold text-text-primary">{numQty}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                <span className="text-text-secondary font-medium">Current Price</span>
                <span className="font-bold text-text-primary">{formatCurrency(lastPrice)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-border-subtle">
                <span className="text-text-secondary font-medium">Estimated Total</span>
                <span className="text-lg font-black text-text-primary">{formatCurrency(estimatedTotal)}</span>
              </div>
            </div>

            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className={cn(
                "w-full h-14 rounded-xl font-bold text-bg-primary transition-all flex items-center justify-center text-lg active:scale-[0.98]",
                side === 'BUY' ? "bg-positive" : "bg-negative",
                isExecuting && "opacity-80"
              )}
            >
              {isExecuting ? 'Executing...' : 'Confirm Order'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
