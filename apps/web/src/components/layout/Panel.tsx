'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Whether the panel should independently scroll its contents */
  scrollable?: boolean;
  /** Explicit grid area name if using template-areas, otherwise relies on source order */
  area?: string;
  /** Mobile specific behavior. Hide this panel on mobile? */
  hideOnMobile?: boolean;
}

export function Panel({ 
  children, 
  className, 
  scrollable = false, 
  area, 
  hideOnMobile = false,
  ...props 
}: PanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col relative w-full h-full",
        
        // Scrolling setup
        scrollable ? "overflow-y-auto scrollbar-hide" : "overflow-hidden",
        
        // Borders to delineate panels on desktop
        "lg:border-r lg:border-border-subtle last:border-r-0",
        
        // Mobile visibility
        hideOnMobile ? "hidden lg:flex" : "flex",
        
        className
      )}
      style={{
        gridArea: area,
        WebkitOverflowScrolling: scrollable ? 'touch' : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
