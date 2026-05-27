'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, Briefcase, Eye, Trophy } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/markets', label: 'Markets', icon: BarChart3 },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase },
  { href: '/watchlist', label: 'Watchlist', icon: Eye },
  { href: '/leaderboard', label: 'Ranks', icon: Trophy },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-subtle bg-bg-primary/95 backdrop-blur-md lg:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center justify-center gap-1 rounded-lg px-2 transition-all duration-150 ease-out min-h-[44px] min-w-[44px]',
                isActive
                  ? 'text-accent'
                  : 'text-text-muted hover:text-text-secondary active:scale-95',
              )}
            >
              <item.icon className="h-6 w-6" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
      {/* Safe area for notched phones */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
