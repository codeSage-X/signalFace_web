'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { BarChart3, DollarSign, Gift, Sparkles, Users } from 'lucide-react';
import { realmsApi, type CreatorDashboard, type DashboardRange } from '@/lib/api';
import { useProfileMode } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';
import { DASH } from '@/components/dashboard/theme';
import { PortfolioValueCard, type Range } from '@/components/dashboard/PortfolioValueCard';
import { StatTile } from '@/components/dashboard/StatTile';
import {
  PerformanceOverviewCard,
  type PerfRange,
} from '@/components/dashboard/PerformanceOverviewCard';
import { HoldersDistributionCard } from '@/components/dashboard/HoldersDistributionCard';
import { RealmTopHoldersCard } from '@/components/dashboard/RealmTopHoldersCard';
import { RealmActivityCard } from '@/components/dashboard/RealmActivityCard';

/**
 * The hero card's own range control is the 24H/7D/30D/ALL set; the performance
 * chart below uses 7D/30D/90D/1Y. Only the latter reaches the API, so the hero
 * range maps onto it for fetching.
 */
const HERO_TO_API: Record<Range, DashboardRange> = {
  '24H': '7D',
  '7D': '7D',
  '30D': '30D',
  ALL: '1Y',
};

export default function CreatorDashboardPage() {
  const setBecomeCreatorOpen = useProfileMode((s) => s.setBecomeCreatorOpen);
  const { realm, isCreator } = useProfileSwitch();

  const [data, setData] = useState<CreatorDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [heroRange, setHeroRange] = useState<Range>('7D');
  const [perfRange, setPerfRange] = useState<PerfRange>('30D');

  // The performance chart drives the fetch; it asks for the widest window of the
  // two controls, and the hero sparkline reads from the same series.
  const apiRange: DashboardRange = useMemo(() => {
    const heroEquivalent = HERO_TO_API[heroRange];
    const order: DashboardRange[] = ['7D', '30D', '90D', '1Y'];
    return order.indexOf(perfRange) >= order.indexOf(heroEquivalent) ? perfRange : heroEquivalent;
  }, [heroRange, perfRange]);

  useEffect(() => {
    if (!isCreator) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    realmsApi
      .dashboard(apiRange)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load your dashboard.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isCreator, apiRange]);

  // The hero sparkline shares the fetched series, trimmed to its own window.
  const heroSeries = useMemo(() => {
    if (!data) return [];
    const days = heroRange === '24H' ? 1 : heroRange === '7D' ? 7 : heroRange === '30D' ? 30 : 365;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    return data.performance
      .filter((p) => new Date(p.date).getTime() >= cutoff)
      .map((p) => ({ label: p.date, value: p.value }));
  }, [data, heroRange]);

  if (!isCreator || !realm) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-full brand-gradient flex items-center justify-center mb-5">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: DASH.ink }}>
            The creator dashboard is for creators
          </h1>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: DASH.inkMuted }}>
            Create your realm to mint a tradable Signal, then track its value,
            holders and volume here.
          </p>
          <button
            onClick={() => setBecomeCreatorOpen(true)}
            className="mt-6 px-6 py-3 rounded-xl font-semibold text-white text-sm brand-gradient brand-glow hover:brightness-110 transition"
          >
            Become a creator
          </button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-full p-4 lg:p-8">
        <div className="space-y-4 lg:space-y-5">
          <div className="glass-card h-40 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card h-24 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="glass-card h-80 rounded-2xl animate-pulse" />
            <div className="glass-card h-80 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="font-semibold" style={{ color: DASH.ink }}>
            Could not load your dashboard
          </p>
          <p className="mt-1 text-sm" style={{ color: DASH.inkMuted }}>
            {error ?? 'Please try again.'}
          </p>
        </div>
      </div>
    );
  }

  const { totals, signal } = data;
  const signalValue = Number(totals.signalValue);

  return (
    <div className="relative min-h-full p-4 lg:p-8">
      <div className="relative z-10 space-y-4 lg:space-y-5 max-w-[1400px]">
        {/* ── Page heading ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-xl overflow-hidden brand-gradient flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
              {data.realm.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.realm.iconUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                data.realm.name.charAt(0).toUpperCase()
              )}
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold truncate" style={{ color: DASH.ink }}>
                {data.realm.name}
              </h1>
              <p className="text-xs" style={{ color: DASH.inkMuted }}>
                Creator dashboard · {totals.followers.toLocaleString()} followers
              </p>
            </div>
          </div>

          <NextLink
            href="/app/realm"
            className="glass-chip px-4 py-2 rounded-xl text-sm font-medium text-foreground transition hover:brightness-125"
          >
            View realm
          </NextLink>
        </div>

        {/* ── Hero: total Signal value ─────────────────────────────────────── */}
        <PortfolioValueCard
          label="Total Signal Value"
          hint="Every share of your Signal held by fans, valued at the current price."
          totalValue={signalValue}
          changePct={totals.valueChangePct}
          changeAbs={Number(totals.valueChange)}
          series={heroSeries}
          range={heroRange}
          onRangeChange={setHeroRange}
        />

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatTile
            label="Total Holders"
            value={totals.holders.toLocaleString()}
            sub={
              totals.newHoldersThisWeek > 0
                ? `+${totals.newHoldersThisWeek} this week`
                : 'No new holders this week'
            }
            subTone={totals.newHoldersThisWeek > 0 ? 'up' : 'muted'}
            icon={Users}
          />
          <StatTile
            label="Signal Price"
            value={`$${signal.price}`}
            sub={`${signal.priceChangePct >= 0 ? '+' : '−'}${Math.abs(signal.priceChangePct).toFixed(2)}%`}
            subTone={signal.priceChangePct >= 0 ? 'up' : 'down'}
            icon={DollarSign}
          />
          <StatTile
            label="Total Volume"
            value={`$${Number(totals.volume).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`}
            sub={
              totals.volumeChangePct > 0
                ? `+${totals.volumeChangePct.toFixed(2)}% in 24h`
                : 'No trades in 24h'
            }
            subTone={totals.volumeChangePct > 0 ? 'up' : 'muted'}
            icon={BarChart3}
          />
          <StatTile
            label="Rewards Earned"
            value={Number(totals.rewards).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
            valuePrefix="SF"
            sub="Credited to your wallet"
            icon={Gift}
          />
        </div>

        {/* ── Performance + holder concentration ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          <PerformanceOverviewCard
            points={data.performance}
            range={perfRange}
            onRangeChange={setPerfRange}
          />
          <HoldersDistributionCard bands={data.distribution} totalHolders={totals.holders} />
        </div>

        {/* ── Activity + top holders ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          <RealmActivityCard entries={data.recentActivity} />
          <RealmTopHoldersCard holders={data.topHolders} />
        </div>
      </div>
    </div>
  );
}
