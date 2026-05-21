'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardGridProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * DashboardGrid
 * Implements the core CSS Grid architecture for the desktop trading workspace.
 * Falls back to a flex column layout on mobile/tablets.
 */
export function DashboardGrid({ children, className, ...props }: DashboardGridProps) {
  return (
    <div
      className={cn(
        // Mobile Layout: Stacked, flexible
        "flex-1 flex flex-col w-full h-full lg:overflow-hidden",
        
        // Desktop Layout: CSS Grid
        "lg:grid lg:grid-rows-1 lg:h-full lg:w-full",
        
        // Grid Template: Watchlist (left), Chart (center), Order (right)
        "lg:grid-cols-[minmax(280px,340px)_1fr_minmax(320px,380px)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
