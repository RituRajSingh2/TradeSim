import React from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export enum InsightDomain {
  ALERT = 'ALERT',
  PORTFOLIO = 'PORTFOLIO',
  WATCHLIST = 'WATCHLIST',
  HOLDING = 'HOLDING',
  MARKET = 'MARKET',
}

export interface BriefingInsight {
  id: string;
  domain: InsightDomain;
  narrative: string;
  priority: number;
}

interface BriefingResponse {
  success: boolean;
  data: {
    insights: BriefingInsight[];
  };
}

async function fetchBriefing(token: string): Promise<BriefingInsight[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/briefing/morning-context`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      next: { revalidate: 30 }, // Cache invalidation logic
    });
    
    if (!res.ok) {
      return [];
    }

    const json = (await res.json()) as BriefingResponse;
    return json.data.insights || [];
  } catch (error) {
    return [];
  }
}

function MarketContextBanner({ insight }: { insight?: BriefingInsight }) {
  return (
    <div className="mb-6 flex items-center justify-between border-b border-border-subtle pb-4">
      <h2 className="text-sm font-semibold tracking-wide text-text-primary uppercase">
        Morning Briefing
      </h2>
      {insight && <span className="text-xs text-text-muted">{insight.narrative}</span>}
    </div>
  );
}

function PersonalContextSection({ insights }: { insights: BriefingInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {insights.map((insight) => (
        <div key={insight.id} className="flex items-start gap-3">
          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/60" />
          <p className="text-sm leading-relaxed text-text-secondary">
            {insight.narrative}
          </p>
        </div>
      ))}
    </div>
  );
}

export default async function MorningBriefing() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const insights = await fetchBriefing(token);

  // Separate market rhythm fallback from personal context
  const marketInsight = insights.find(i => i.domain === InsightDomain.MARKET);
  const personalInsights = insights.filter(i => i.domain !== InsightDomain.MARKET);

  return (
    <div className="flex flex-col mb-8 p-6 bg-surface-primary rounded-xl border border-border-subtle shadow-sm">
      <MarketContextBanner insight={marketInsight} />
      <PersonalContextSection insights={personalInsights} />
    </div>
  );
}
