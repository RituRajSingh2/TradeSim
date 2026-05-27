import type { Metadata } from 'next';
import { PortfolioClient } from './portfolio-client';

export const metadata: Metadata = {
  title: 'Portfolio',
};

export default function PortfolioPage() {
  return (
    <div className="flex w-full flex-col min-h-full pb-20">
      <PortfolioClient />
    </div>
  );
}
