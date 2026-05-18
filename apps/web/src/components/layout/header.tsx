'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, User } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { clsx } from 'clsx';

export function Header() {
  const pathname = usePathname();

  // Derive page title from path
  const getTitle = (): string => {
    const segments = pathname.split('/').filter(Boolean);
    const page = segments[0] || 'home';
    const titles: Record<string, string> = {
      home: 'Dashboard',
      markets: 'Markets',
      portfolio: 'Portfolio',
      watchlist: 'Watchlist',
      leaderboard: 'Leaderboard',
      profile: 'Profile',
      stock: 'Stock Detail',
    };
    return titles[page] || 'TradeSim';
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border-subtle glass-strong">
      <div className="mx-auto flex h-14 max-w-[var(--container-max)] items-center justify-between px-[var(--spacing-page)] sm:h-16">
        {/* Logo — visible on desktop */}
        <div className="hidden sm:block">
          <Logo size="md" />
        </div>

        {/* Page title — visible on mobile */}
        <h1 className="text-lg font-semibold sm:hidden">{getTitle()}</h1>

        {/* Desktop navigation */}
        <nav className="hidden items-center gap-1 sm:flex">
          {[
            { href: '/home', label: 'Dashboard' },
            { href: '/markets', label: 'Markets' },
            { href: '/portfolio', label: 'Portfolio' },
            { href: '/watchlist', label: 'Watchlist' },
            { href: '/leaderboard', label: 'Leaderboard' },
          ].map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-subtle text-accent'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
          </button>
          <Link
            href="/profile"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-bg-tertiary hover:text-text-primary"
            aria-label="Profile"
          >
            <User className="h-4.5 w-4.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
