'use client';

import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useThrottledPortfolio } from '@/hooks/use-throttled-portfolio';
import { PortfolioOverview } from '@/components/portfolio/PortfolioOverview';
import { HoldingsList } from '@/components/portfolio/HoldingsList';
import { TransactionHistory } from '@/components/portfolio/TransactionHistory';

export function PortfolioClient() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { portfolio, getEffectiveBuyingPower, getEffectiveHoldingQuantity } = useThrottledPortfolio();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login?returnTo=/portfolio');
    }
  }, [isLoading, isAuthenticated, router]);

  if (!isAuthenticated || !portfolio) return null;

  return (
    <div className="flex flex-col gap-4 pt-4 px-4">
      <PortfolioOverview portfolio={portfolio} getEffectiveBuyingPower={getEffectiveBuyingPower} />
      <HoldingsList portfolio={portfolio} getEffectiveHoldingQuantity={getEffectiveHoldingQuantity} />
      <TransactionHistory />
    </div>
  );
}
