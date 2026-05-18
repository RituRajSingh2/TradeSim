import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const sizeConfig = {
  sm: { container: 'h-6 w-6 rounded-md', icon: 'h-3 w-3', text: 'text-sm' },
  md: { container: 'h-8 w-8 rounded-lg', icon: 'h-4 w-4', text: 'text-lg' },
  lg: { container: 'h-10 w-10 rounded-xl', icon: 'h-5 w-5', text: 'text-xl' },
};

export function Logo({ size = 'md', showText = true, className }: LogoProps) {
  const config = sizeConfig[size];

  return (
    <Link href="/" className={clsx('flex items-center gap-2', className)}>
      <div
        className={clsx(
          'flex items-center justify-center bg-accent',
          config.container,
        )}
      >
        <TrendingUp
          className={clsx('text-bg-primary', config.icon)}
          strokeWidth={2.5}
        />
      </div>
      {showText && (
        <span
          className={clsx('font-bold tracking-tight text-text-primary', config.text)}
        >
          TradeSim
        </span>
      )}
    </Link>
  );
}
