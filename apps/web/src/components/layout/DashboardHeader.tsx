'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Activity, Settings, User } from 'lucide-react';
import { NotificationCenter } from '../notifications/NotificationCenter';

export function DashboardHeader({ className }: { className?: string }) {
  return (
    <header
      className={cn(
        "h-16 w-full border-b border-border-primary bg-bg-secondary flex items-center justify-between px-4 lg:px-6 shrink-0 z-dropdown",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
          <Activity className="h-5 w-5 text-accent" />
        </div>
        <span className="font-bold text-lg text-text-primary tracking-tight">TradeSim</span>
      </div>

      <div className="flex items-center gap-4 text-text-secondary">
        <NotificationCenter />
        <button className="hover:text-text-primary transition-colors">
          <Settings className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-full bg-bg-tertiary border border-border-subtle flex items-center justify-center ml-2 cursor-pointer hover:border-border-primary transition-colors">
          <User className="h-4 w-4" />
        </div>
      </div>
    </header>
  );
}
