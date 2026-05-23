'use client';

import React from 'react';
import { useSocket } from '@/lib/websocket/use-socket';
import { useAuth } from '@/providers/auth-provider';
import { useMarketHealthStore } from '@/stores/market-health-store';

export function NetworkStatusBanner() {
  const { user, isLoading } = useAuth();
  
  // Only connect/monitor socket if user is logged in
  if (isLoading || !user) {
    return null;
  }

  return <NetworkStatusBannerInner />;
}

function NetworkStatusBannerInner() {
  const { status } = useSocket();
  const { globalStaleness, isSimulated } = useMarketHealthStore();

  if (status === 'connected' && !isSimulated && globalStaleness === 'fresh') {
    return null; // All good
  }

  let message = 'Connecting to market data...';
  let bgColor = 'bg-status-warning/90';
  let textColor = 'text-status-warning';
  let showSpinner = true;
  let showWarningIcon = false;
  
  if (status === 'disconnected') {
    message = 'Disconnected from market. Reconnecting...';
    bgColor = 'bg-status-error/90';
    textColor = 'text-white';
  } else if (status === 'connecting') {
    message = 'Connection lost. Attempting to reconnect...';
    bgColor = 'bg-status-warning/90';
    textColor = 'text-black';
  } else if (status === 'error') {
    message = 'Connection error. Market data may be delayed.';
    bgColor = 'bg-status-error/90';
    textColor = 'text-white';
  } else if (isSimulated) {
    message = 'Simulated Market Data (Provider Fallback Active)';
    bgColor = 'bg-amber-500/90';
    textColor = 'text-black';
    showSpinner = false;
    showWarningIcon = true;
  } else if (globalStaleness === 'expired') {
    message = 'Expired Market Data - Trading Disabled';
    bgColor = 'bg-red-900/90';
    textColor = 'text-white';
    showSpinner = false;
    showWarningIcon = true;
  } else if (globalStaleness === 'critical') {
    message = 'Critically Stale Market Data - Trading Discouraged';
    bgColor = 'bg-status-error/90';
    textColor = 'text-white';
    showSpinner = false;
    showWarningIcon = true;
  } else if (globalStaleness === 'delayed') {
    message = 'Delayed Market Data (Provider degraded)';
    bgColor = 'bg-amber-400/90';
    textColor = 'text-black';
    showSpinner = false;
    showWarningIcon = true;
  }

  return (
    <div className={`w-full ${bgColor} ${textColor} px-4 py-1.5 text-xs font-medium text-center shadow-md animate-in slide-in-from-top-2 z-50 fixed top-0 left-0`}>
      <div className="flex items-center justify-center gap-2">
        {showSpinner && (
          <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {showWarningIcon && (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        )}
        {message}
      </div>
    </div>
  );
}
