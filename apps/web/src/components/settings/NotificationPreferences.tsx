'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Bell, Sunset, Sunrise, Activity } from 'lucide-react';
import type { NotificationPreferences } from '@tradesim/shared';
import { apiClient } from '@/lib/api-client';

export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await apiClient.get<{ data: NotificationPreferences }>('/retention/preferences');
        setPrefs(res.data.data);
      } catch (e) {
        console.error('Failed to load preferences', e);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const togglePref = async (key: keyof NotificationPreferences) => {
    if (!prefs) return;
    
    // Optimistic update
    const prev = { ...prefs };
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);

    try {
      await apiClient.patch('/retention/preferences', { [key]: updated[key] });
    } catch (e) {
      console.error('Failed to update preference', e);
      setPrefs(prev); // rollback
    }
  };

  if (loading || !prefs) {
    return <div className="h-40 animate-pulse bg-[#1E1E24] rounded-xl"></div>;
  }

  return (
    <Card variant="elevated" padding="lg" className="flex flex-col gap-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary">Market Rhythm Notifications</h3>
        <p className="text-sm text-text-secondary mt-1">
          Stay connected to the market without the noise. Choose what matters to you.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Market Open */}
        <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-subtle">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg">
              <Sunrise className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-text-primary">Market Open Reminder</p>
              <p className="text-xs text-text-tertiary">Morning notification when trading begins (09:15 IST).</p>
            </div>
          </div>
          <button 
            onClick={() => togglePref('marketOpen')}
            className={`w-11 h-6 rounded-full transition-colors relative ${prefs.marketOpen ? 'bg-emerald-500' : 'bg-border-subtle'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${prefs.marketOpen ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* EOD Summary */}
        <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-subtle">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <Sunset className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-text-primary">Daily Portfolio Snapshot</p>
              <p className="text-xs text-text-tertiary">End-of-day summary of your portfolio performance.</p>
            </div>
          </div>
          <button 
            onClick={() => togglePref('eodSummary')}
            className={`w-11 h-6 rounded-full transition-colors relative ${prefs.eodSummary ? 'bg-emerald-500' : 'bg-border-subtle'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${prefs.eodSummary ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {/* Watchlist Alerts */}
        <div className="flex items-center justify-between p-4 bg-bg-secondary rounded-lg border border-border-subtle">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-text-primary">Watchlist Activity</p>
              <p className="text-xs text-text-tertiary">Major movements in symbols you are watching.</p>
            </div>
          </div>
          <button 
            onClick={() => togglePref('watchlistAlerts')}
            className={`w-11 h-6 rounded-full transition-colors relative ${prefs.watchlistAlerts ? 'bg-emerald-500' : 'bg-border-subtle'}`}
          >
            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${prefs.watchlistAlerts ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </Card>
  );
}
