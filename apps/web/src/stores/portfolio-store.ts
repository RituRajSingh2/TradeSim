import { create } from 'zustand';
import type { WsPortfolioUpdatePayload, PlaceOrderRequest, OrderSide } from '@tradesim/shared';

export interface OptimisticTransaction {
  idempotencyKey: string;
  side: OrderSide;
  symbol: string;
  quantity: number;
  price: number;
  createdAt: string;
}

export interface OptimisticDelta {
  pendingBuyingPowerDeduction: number;
  pendingHoldingDeductions: Record<string, number>; // symbol -> quantity
  pendingIdempotencyKeys: Set<string>;
  pendingTransactions: OptimisticTransaction[];
}

export interface PortfolioState {
  // Server-authoritative state
  portfolio: WsPortfolioUpdatePayload | null;
  serverVersion: number;
  
  // Client-side optimistic state
  optimisticDelta: OptimisticDelta;

  // Derived getters
  getEffectiveBuyingPower: () => number;
  getEffectiveHoldingQuantity: (symbol: string) => number;

  // Actions
  reconcilePortfolio: (payload: WsPortfolioUpdatePayload) => void;
  executeOrderOptimistically: (
    orderParams: Omit<PlaceOrderRequest, 'idempotencyKey'>,
    lastPrice: number,
    submitOrderFn: (payload: PlaceOrderRequest) => Promise<any>
  ) => Promise<void>;
  clearPendingOrder: (idempotencyKey: string) => void;
  clearPendingTransactions: () => void;
}

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  portfolio: null,
  serverVersion: -1,

  optimisticDelta: {
    pendingBuyingPowerDeduction: 0,
    pendingHoldingDeductions: {},
    pendingIdempotencyKeys: new Set(),
    pendingTransactions: [],
  },

  getEffectiveBuyingPower: () => {
    const { portfolio, optimisticDelta } = get();
    if (!portfolio) return 0;
    return portfolio.balance - optimisticDelta.pendingBuyingPowerDeduction;
  },

  getEffectiveHoldingQuantity: (symbol: string) => {
    const { portfolio, optimisticDelta } = get();
    if (!portfolio) return 0;
    
    const holding = portfolio.holdings.find(h => h.symbol === symbol);
    const baseQuantity = holding ? holding.quantity : 0;
    const pendingDeduction = optimisticDelta.pendingHoldingDeductions[symbol] || 0;
    
    return baseQuantity - pendingDeduction;
  },

  reconcilePortfolio: (payload) => {
    const { serverVersion, optimisticDelta } = get();
    
    // Strict versioning: Ignore stale reconciliation payloads
    if (payload.version <= serverVersion) {
      return;
    }

    set({
      portfolio: payload,
      serverVersion: payload.version,
      // We clear ALL optimistic state on a successful portfolio sync,
      // as the server has reconciled everything up to this version.
      optimisticDelta: {
        pendingBuyingPowerDeduction: 0,
        pendingHoldingDeductions: {},
        pendingIdempotencyKeys: new Set(),
        pendingTransactions: optimisticDelta.pendingTransactions, // Preserve transactions!
      }
    });
  },

  executeOrderOptimistically: async (orderParams, lastPrice, submitOrderFn) => {
    const { getEffectiveBuyingPower, getEffectiveHoldingQuantity, optimisticDelta } = get();
    const { symbol, side, quantity } = orderParams;

    // 1. Client-Side Pre-validation
    if (side === 'BUY') {
      // 2% slippage safety buffer
      const requiredBuyingPower = (quantity * lastPrice) * 1.02;
      const effectiveBp = getEffectiveBuyingPower();
      if (effectiveBp < requiredBuyingPower) {
        throw new Error('Insufficient buying power (including 2% slippage buffer).');
      }
    } else if (side === 'SELL') {
      const effectiveQty = getEffectiveHoldingQuantity(symbol);
      if (effectiveQty < quantity) {
        throw new Error('Insufficient holdings.');
      }
    }

    // 2. Generate Idempotency Key
    const idempotencyKey = crypto.randomUUID();

    // 3. Apply Optimistic Mutation
    set((state) => {
      const newDelta = { ...state.optimisticDelta };
      
      // Deduct buying power for BUYs
      if (side === 'BUY') {
        const estimatedCost = quantity * lastPrice;
        newDelta.pendingBuyingPowerDeduction += estimatedCost;
      }
      
      // Deduct holdings for SELLs
      if (side === 'SELL') {
        newDelta.pendingHoldingDeductions[symbol] = 
          (newDelta.pendingHoldingDeductions[symbol] || 0) + quantity;
      }

      // Track pending key
      const newKeys = new Set(newDelta.pendingIdempotencyKeys);
      newKeys.add(idempotencyKey);
      newDelta.pendingIdempotencyKeys = newKeys;

      // Add optimistic transaction
      newDelta.pendingTransactions = [
        {
          idempotencyKey,
          side,
          symbol,
          quantity,
          price: lastPrice,
          createdAt: new Date().toISOString(),
        },
        ...newDelta.pendingTransactions,
      ];

      return { optimisticDelta: newDelta };
    });

    try {
      // 4. Fire REST Request
      await submitOrderFn({
        ...orderParams,
        idempotencyKey,
      });
      // Do nothing on success! 
      // The WebSocket PORTFOLIO_UPDATE will overwrite and clear the optimistic state.
    } catch (error) {
      // 5. Rollback on Network Failure / REST Error
      set((state) => {
        const newDelta = { ...state.optimisticDelta };
        
        if (side === 'BUY') {
          const estimatedCost = quantity * lastPrice;
          newDelta.pendingBuyingPowerDeduction = Math.max(0, newDelta.pendingBuyingPowerDeduction - estimatedCost);
        }
        
        if (side === 'SELL') {
          newDelta.pendingHoldingDeductions[symbol] = Math.max(0, (newDelta.pendingHoldingDeductions[symbol] || 0) - quantity);
        }

        const newKeys = new Set(newDelta.pendingIdempotencyKeys);
        newKeys.delete(idempotencyKey);
        newDelta.pendingIdempotencyKeys = newKeys;
        
        newDelta.pendingTransactions = newDelta.pendingTransactions.filter(
          (tx) => tx.idempotencyKey !== idempotencyKey
        );

        return { optimisticDelta: newDelta };
      });
      throw error;
    }
  },

  clearPendingOrder: (idempotencyKey) => {
    set((state) => {
      const newKeys = new Set(state.optimisticDelta.pendingIdempotencyKeys);
      newKeys.delete(idempotencyKey);
      return { 
        optimisticDelta: {
          ...state.optimisticDelta,
          pendingIdempotencyKeys: newKeys
        } 
      };
    });
  },

  clearPendingTransactions: () => {
    set((state) => ({
      optimisticDelta: {
        ...state.optimisticDelta,
        pendingTransactions: [],
      }
    }));
  }
}));
