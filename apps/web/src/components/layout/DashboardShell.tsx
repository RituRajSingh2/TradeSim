'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface DashboardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

/**
 * DashboardShell
 * The root container for the trading workspace.
 * Strictly enforces h-screen and overflow-hidden to prevent window-level scrolling.
 * Sets the base z-index context.
 */
export function DashboardShell({ children, className, ...props }: DashboardShellProps) {
  return (
    <main
      className={cn(
        "h-dvh w-screen overflow-hidden bg-bg-primary text-text-primary flex flex-col z-base",
        className
      )}
      {...props}
    >
      {children}
    </main>
  );
}
