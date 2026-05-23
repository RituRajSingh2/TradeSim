import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/providers/auth-provider';
import { NetworkStatusBanner } from '@/components/layout/NetworkStatusBanner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'TradeSim — Paper Trading for Indian Markets',
    template: '%s | TradeSim',
  },
  description:
    'Practice stock trading with ₹10,000 virtual balance. Trade NSE stocks with real-time data, professional charts, and zero risk.',
  keywords: [
    'paper trading',
    'stock market simulator',
    'NSE trading',
    'virtual trading India',
    'stock practice',
    'TradeSim',
  ],
  authors: [{ name: 'TradeSim' }],
  openGraph: {
    title: 'TradeSim — Paper Trading for Indian Markets',
    description:
      'Practice stock trading with ₹10,000 virtual balance. Trade NSE stocks with real-time data, professional charts, and zero risk.',
    type: 'website',
    locale: 'en_IN',
    siteName: 'TradeSim',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TradeSim — Paper Trading for Indian Markets',
    description:
      'Practice stock trading with ₹10,000 virtual balance. Zero risk, real markets.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0A0A0B',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg-primary text-text-primary antialiased">
        <AuthProvider>
          <NetworkStatusBanner />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
