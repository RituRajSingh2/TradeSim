'use client';

import { useEffect, useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { apiGet } from '@/lib/api-client';
import { Trophy, Medal, MapPin } from 'lucide-react';
import { clsx } from 'clsx';

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all_time';
type Scope = 'global' | 'state:mh' | 'city:mumbai'; // hardcoded examples for state/city

interface Ranking {
  userId: string;
  rank: number;
  score: number;
  user: {
    id: string;
    name: string;
    avatarUrl: string | null;
    city: string | null;
    state: string | null;
  };
}

export function LeaderboardDashboard() {
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly');
  const [scope, setScope] = useState<Scope>('global');
  const [rankings, setRankings] = useState<Ranking[]>([]);
  const [myRank, setMyRank] = useState<{ rank: number; score: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchLeaderboard = async () => {
      setIsLoading(true);
      try {
        const [boardRes, myRankRes] = await Promise.all([
          apiGet<{ data: Ranking[] }>(`/leaderboard?scope=${scope}&timeframe=${timeframe}&metric=return_percent`),
          apiGet<{ data: { rank: number; score: number } | null }>(`/leaderboard/me?scope=${scope}&timeframe=${timeframe}&metric=return_percent`)
        ]);
        if (isMounted) {
          setRankings(boardRes.data);
          setMyRank(myRankRes.data);
        }
      } catch (err) {
        console.error('Failed to load leaderboard', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchLeaderboard();
    return () => { isMounted = false; };
  }, [timeframe, scope]);

  const rowVirtualizer = useVirtualizer({
    count: rankings.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 72, // height of each row
    overscan: 5,
  });

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-6 w-6 text-yellow-400" />
          <h2 className="text-xl font-bold tracking-tight text-text-primary">Leaderboard</h2>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <select 
            value={scope} 
            onChange={(e) => setScope(e.target.value as Scope)}
            className="rounded-md border border-border-subtle bg-bg-secondary px-3 py-1.5 text-sm text-text-primary outline-none"
          >
            <option value="global">Global</option>
            <option value="state:mh">Maharashtra</option>
            <option value="city:mumbai">Mumbai</option>
          </select>
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value as Timeframe)}
            className="rounded-md border border-border-subtle bg-bg-secondary px-3 py-1.5 text-sm text-text-primary outline-none"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="all_time">All Time</option>
          </select>
        </div>
      </div>

      {/* My Rank Summary */}
      <div className="flex items-center justify-between rounded-xl border border-border-subtle glass-panel p-4 bg-accent/5">
        <div>
          <div className="text-sm font-medium text-text-secondary">My Current Rank</div>
          <div className="text-2xl font-bold text-text-primary">
            {myRank ? `#${myRank.rank}` : 'Unranked'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-text-secondary">Return</div>
          <div className={clsx("text-lg font-bold", myRank && myRank.score >= 0 ? "text-positive" : "text-negative")}>
            {myRank ? `${myRank.score > 0 ? '+' : ''}${myRank.score.toFixed(2)}%` : '-'}
          </div>
        </div>
      </div>

      {/* Rankings List */}
      <div 
        ref={scrollRef} 
        className="flex-1 rounded-xl border border-border-subtle glass-panel overflow-y-auto custom-scrollbar"
      >
        {isLoading ? (
          <div className="flex h-32 items-center justify-center text-text-muted">Loading rankings...</div>
        ) : rankings.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-text-muted">No rankings available for this timeframe.</div>
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const r = rankings[virtualRow.index];
              return (
                <div
                  key={r.userId}
                  className="absolute top-0 left-0 w-full flex items-center justify-between border-b border-border-subtle px-4 hover:bg-bg-tertiary transition-colors"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex w-8 justify-center font-bold text-text-primary">
                      {r.rank === 1 ? <Medal className="h-5 w-5 text-yellow-400" /> :
                       r.rank === 2 ? <Medal className="h-5 w-5 text-gray-400" /> :
                       r.rank === 3 ? <Medal className="h-5 w-5 text-amber-600" /> :
                       `#${r.rank}`}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-bg-secondary border border-border-subtle">
                        {r.user.avatarUrl ? (
                          <img src={r.user.avatarUrl} alt={r.user.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-lg font-bold text-text-muted">
                            {r.user.name.charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-text-primary">{r.user.name}</span>
                        {(r.user.city || r.user.state) && (
                          <span className="flex items-center gap-1 text-xs text-text-muted">
                            <MapPin className="h-3 w-3" />
                            {r.user.city || r.user.state}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={clsx("font-bold", r.score >= 0 ? "text-positive" : "text-negative")}>
                    {r.score > 0 ? '+' : ''}{r.score.toFixed(2)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
