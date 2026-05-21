'use client';

import { useRef, useCallback, type CSSProperties } from 'react';
import { useVirtualizer, type VirtualizerOptions } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

export interface VirtualListProps<T> {
  /** The data array */
  items: T[];
  /** Render function for each item */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Fixed height or estimate function for dynamic heights */
  estimateSize?: (index: number) => number;
  /** Parent container class names */
  className?: string;
  /** Overscan count (items to render outside viewport) */
  overscan?: number;
  /** Key extractor for items (crucial for stability and future drag-and-drop) */
  keyExtractor: (item: T, index: number) => string | number;
  /** Disable dynamic measurement if row heights are strictly fixed (improves stability) */
  isFixedSize?: boolean;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize = () => 50, // Default 50px height
  className,
  overscan = 5,
  keyExtractor,
  isFixedSize = true, // Default to true for max performance
}: VirtualListProps<T>) {
  // Container-level scroll reference
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
    getItemKey: (index) => keyExtractor(items[index]!, index),
  });

  return (
    <div
      ref={parentRef}
      className={cn(
        'h-full w-full overflow-y-auto scrollbar-hide', // Must have fixed height or h-full from parent
        className
      )}
      style={{
        // Needed for iOS momentum scrolling
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (!item) return null;

          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              // Only attach measurement ref if we explicitly need dynamic sizing
              ref={isFixedSize ? undefined : virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`, // Explicitly enforce height to prevent internal shift
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
