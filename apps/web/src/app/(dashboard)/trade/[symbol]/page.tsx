import React from 'react';
import { Metadata } from 'next';
import { TradeHeader } from '@/components/trading/TradeHeader';
import { TradeChart } from '@/components/trading/TradeChart';
import { TradeHoldings } from '@/components/trading/TradeHoldings';
import { MobileOrderPanel } from '@/components/trading/MobileOrderPanel';

export const metadata: Metadata = {
  title: 'Trade',
};

// Next.js dynamic route params
interface PageProps {
  params: Promise<{
    symbol: string;
  }>;
}

export default async function TradeSymbolPage(props: PageProps) {
  const params = await props.params;
  const symbol = decodeURIComponent(params.symbol).toUpperCase();

  return (
    <div className="flex flex-col min-h-screen bg-bg-secondary pb-[120px]">
      {/* 1. Sticky Header */}
      <TradeHeader symbol={symbol} />

      {/* 2. Dominant Chart */}
      <div className="border-b border-border-subtle bg-bg-primary">
        <TradeChart symbol={symbol} />
      </div>

      {/* 3. Holdings Summary (Renders conditionally if quantity > 0) */}
      <TradeHoldings symbol={symbol} />

      {/* 4. Sticky Bottom Mobile Order Panel */}
      <MobileOrderPanel symbol={symbol} />
    </div>
  );
}
