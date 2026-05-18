import { HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

type SkeletonVariant = 'text' | 'circular' | 'rectangular' | 'rounded';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Width — accepts any CSS value. */
  width?: string | number;
  /** Height — accepts any CSS value. */
  height?: string | number;
  /** Shape variant. */
  variant?: SkeletonVariant;
  /** Number of skeleton lines to render. */
  count?: number;
  /** Gap between lines when count > 1. */
  gap?: string;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'rounded-md',
  circular: 'rounded-full',
  rectangular: 'rounded-none',
  rounded: 'rounded-xl',
};

/**
 * Skeleton loader for content placeholders.
 *
 * Usage:
 * ```tsx
 * <Skeleton width="100%" height={20} />
 * <Skeleton variant="circular" width={40} height={40} />
 * <Skeleton count={3} height={16} gap="0.5rem" />
 * ```
 */
const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      className,
      width,
      height,
      variant = 'text',
      count = 1,
      gap = '0.5rem',
      style,
      ...props
    },
    ref,
  ) => {
    const skeletonStyle = {
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      ...style,
    };

    if (count > 1) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap }} ref={ref}>
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className={clsx('skeleton', variantStyles[variant], className)}
              style={{
                ...skeletonStyle,
                // Last line is shorter for realistic text skeleton
                width: i === count - 1 && variant === 'text' ? '60%' : skeletonStyle.width,
              }}
              {...props}
            />
          ))}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={clsx('skeleton', variantStyles[variant], className)}
        style={skeletonStyle}
        {...props}
      />
    );
  },
);

Skeleton.displayName = 'Skeleton';

// ---- Pre-built Skeleton Patterns ----

/** Skeleton for a stock list item row. */
export function StockRowSkeleton() {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" width={36} height={36} />
        <div>
          <Skeleton width={80} height={14} />
          <Skeleton width={120} height={12} className="mt-1.5" />
        </div>
      </div>
      <div className="text-right">
        <Skeleton width={60} height={14} />
        <Skeleton width={48} height={12} className="mt-1.5 ml-auto" />
      </div>
    </div>
  );
}

/** Skeleton for the portfolio value card. */
export function PortfolioCardSkeleton() {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-card p-5">
      <Skeleton width={100} height={14} />
      <Skeleton width={160} height={32} className="mt-2" />
      <Skeleton width={120} height={14} className="mt-2" />
    </div>
  );
}

/** Skeleton for a chart area. */
export function ChartSkeleton() {
  return (
    <div className="rounded-xl border border-border-primary bg-bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton width={120} height={20} />
        <Skeleton width={200} height={28} variant="rounded" />
      </div>
      <Skeleton width="100%" height={300} variant="rounded" />
    </div>
  );
}

export { Skeleton, type SkeletonProps };
