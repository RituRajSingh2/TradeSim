'use client';

import { useState } from 'react';
import { Bell, X, TrendingUp, TrendingDown } from 'lucide-react';
import { AlertCondition } from '@tradesim/shared';

interface CreateAlertDialogProps {
  symbol: string;
  ltp: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateAlertDialog({ symbol, ltp, isOpen, onClose, onSuccess }: CreateAlertDialogProps) {
  const [condition, setCondition] = useState<AlertCondition>('ABOVE');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const applyPreset = (percent: number) => {
    const val = ltp * (1 + percent / 100);
    setTargetPrice(val.toFixed(2));
    setCondition(percent > 0 ? 'ABOVE' : 'BELOW');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetPrice) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          symbol,
          targetPrice: Number(targetPrice),
          condition,
        }),
      });

      if (res.ok) {
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="fixed inset-x-4 top-[20%] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 z-[110] bg-[#141416] border border-[#2A2A2E] rounded-xl shadow-2xl max-w-sm w-full animate-fade-in-up">
        
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2E]">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            <h2 className="font-semibold text-gray-100">Set Alert: {symbol}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Current Price</span>
              <span className="font-financial text-gray-100">₹{ltp.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Condition</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCondition('ABOVE')}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  condition === 'ABOVE'
                    ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                    : 'border-[#2A2A2E] bg-[#1A1A1D] text-gray-400 hover:text-gray-200'
                }`}
              >
                <TrendingUp className="w-4 h-4" /> Above
              </button>
              <button
                type="button"
                onClick={() => setCondition('BELOW')}
                className={`flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  condition === 'BELOW'
                    ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                    : 'border-[#2A2A2E] bg-[#1A1A1D] text-gray-400 hover:text-gray-200'
                }`}
              >
                <TrendingDown className="w-4 h-4" /> Below
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Target Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                step="0.05"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                className="w-full bg-[#1A1A1D] border border-[#2A2A2E] rounded-lg py-2.5 pl-7 pr-3 text-gray-100 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 font-financial"
                placeholder="0.00"
                required
              />
            </div>
            
            <div className="flex gap-2 mt-3">
              {[2, 5].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyPreset(pct)}
                  className="px-3 py-1 rounded-full bg-[#1C1C1F] hover:bg-[#2A2A2E] border border-[#2A2A2E] text-xs text-gray-400 transition-colors"
                >
                  +{pct}%
                </button>
              ))}
              {[-2, -5].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyPreset(pct)}
                  className="px-3 py-1 rounded-full bg-[#1C1C1F] hover:bg-[#2A2A2E] border border-[#2A2A2E] text-xs text-gray-400 transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !targetPrice}
            className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors"
          >
            {isSubmitting ? 'Creating...' : 'Set Alert'}
          </button>
        </form>
      </div>
    </>
  );
}
