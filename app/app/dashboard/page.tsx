'use client';

import { useEffect, useMemo, useState } from 'react';
import NextLink from 'next/link';
import { Briefcase, Clock3, ReceiptText, Wallet } from 'lucide-react';
import { useAuth } from '@/lib/stores';
import {
  signalsApi,
  walletApi,
  activityApi,
  type ActivityItem,
  type SignalListItem,
  type WalletOverview,
} from '@/lib/api';
import { syntheticSeries } from '@/lib/series';
import { DASH } from '@/components/dashboard/theme';
import { PortfolioValueCard, type Range } from '@/components/dashboard/PortfolioValueCard';
import { StatTile } from '@/components/dashboard/StatTile';
import { SignalMiniCard, type MiniSignal } from '@/components/dashboard/SignalMiniCard';
import {
  ActivityFeedCard,
  type ActivityEntry,
} from '@/components/dashboard/ActivityFeedCard';
import { TopGainersCard, type GainerRow } from '@/components/dashboard/TopGainersCard';

/** How many samples each range renders. */
const RANGE_POINTS: Record<Range, number> = { '24H': 24, '7D': 28, '30D': 30, ALL: 40 };

const naira = (n: number) =>
  `₦${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function dashboardActivity(item: ActivityItem): ActivityEntry {
  return {
    id: item.id,
    kind:
      item.kind === 'transaction'
        ? 'buy'
        : item.kind === 'follow'
          ? 'referral'
          : item.kind,
    text: item.body ? `${item.title}: ${item.body}` : item.title,
    time: timeAgo(item.createdAt),
    amount: item.amount ?? '',
    tone: item.tone === 'down' ? 'down' : 'up',
  };
}

export default function DashboardPage() {
  const { isAuthenticated, user } = useAuth();

  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('7D');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [signalsResult, walletResult, activityResult] = await Promise.allSettled([
        signalsApi.list(),
        isAuthenticated ? walletApi.getMe() : Promise.resolve(null),
        isAuthenticated ? activityApi.list(null, 5) : Promise.resolve({ items: [] }),
      ]);

      if (cancelled) return;

      if (signalsResult.status === 'fulfilled') setSignals(signalsResult.value);
      setWallet(
        walletResult.status === 'fulfilled' ? (walletResult.value as WalletOverview | null) : null,
      );
      if (activityResult.status === 'fulfilled') {
        setActivity(activityResult.value.items.map(dashboardActivity));
      }
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const holdings = useMemo(() => wallet?.holdings ?? [], [wallet]);

  const totals = useMemo(() => {
    const totalValue = Number(wallet?.totalValue ?? 0);
    const ownershipCost = holdings.reduce(
      (sum, h) => sum + Number(h.quantity) * Number(h.avgBuyPrice),
      0,
    );
    const shares = holdings.reduce((sum, h) => sum + Number(h.quantity), 0);
    const pnl = totalValue - ownershipCost;

    return {
      totalValue,
      ownershipCost,
      shares,
      pnl,
      pnlPct: ownershipCost > 0 ? (pnl / ownershipCost) * 100 : 0,
      rewards: Number(wallet?.pointsBalance ?? 0),
      changePct: wallet?.change24h ?? 0,
    };
  }, [wallet, holdings]);

  /**
   * Portfolio history. No history endpoint exists, so the walk is synthesised
   * between two real numbers: yesterday's implied value and today's actual one.
   */
  const portfolioSeries = useMemo(() => {
    if (totals.totalValue <= 0) return [];
    const prior = totals.totalValue / (1 + totals.changePct / 100);
    return syntheticSeries(`pv-${user?.id ?? 'me'}-${range}`, RANGE_POINTS[range], prior, totals.totalValue);
  }, [totals.totalValue, totals.changePct, range, user?.id]);

  const mySignals: MiniSignal[] = useMemo(
    () =>
      holdings.map((h) => {
        const avg = Number(h.avgBuyPrice);
        const current = Number(h.currentPrice);
        const value = Number(h.currentValue);

        return {
          id: h.signalId,
          name: h.creatorName,
          meta: `@${h.creatorUsername}`,
          price: current,
          changePct: avg > 0 ? (current / avg - 1) * 100 : 0,
          portfolioPct: totals.totalValue > 0 ? (value / totals.totalValue) * 100 : 0,
          series: syntheticSeries(`sig-${h.signalId}`, 20, avg, current),
        };
      }),
    [holdings, totals.totalValue],
  );

  const topGainers: GainerRow[] = useMemo(
    () =>
      [...signals]
        .sort((a, b) => Number(b.growthPct) - Number(a.growthPct))
        .slice(0, 4)
        .map((s) => ({
          id: s.id,
          name: s.creatorName,
          meta: `@${s.creatorUsername}`,
          avatarUrl: s.creatorAvatarUrl,
          price: Number(s.price),
          changePct: Number(s.growthPct),
          href: `/app/u/${s.creatorUsername}`,
        })),
    [signals],
  );

  if (loading) {
    return (
      <div className="min-h-full p-4 lg:p-8">
        <div className="space-y-4 lg:space-y-5">
          <div className="glass-card h-40 rounded-2xl animate-pulse" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="glass-card h-24 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="glass-card h-64 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  // The ambient blooms the glass blurs against are painted once by the app
  // shell, so this screen only lays out.
  return (
    <div className="relative min-h-full p-4 lg:p-8">
      <div className="space-y-4 lg:space-y-5 max-w-[1400px]">
        {/* Portfolio hero */}
        <PortfolioValueCard
          totalValue={totals.totalValue}
          changePct={totals.changePct}
          series={portfolioSeries}
          range={range}
          onRangeChange={setRange}
        />

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <StatTile
            label="Total Portfolio Value"
            value={naira(totals.totalValue)}
            sub={holdings.length > 0 ? `${holdings.length} signals owned` : 'No holdings yet'}
            icon={Briefcase}
          />
          <StatTile
            label="24-hour Change"
            value={`${totals.changePct >= 0 ? '+' : '−'}${Math.abs(totals.changePct).toFixed(2)}%`}
            tone={totals.changePct >= 0 ? 'up' : 'down'}
            sub="Weighted across holdings"
            icon={Clock3}
          />
          <StatTile
            label="Holdings"
            value={String(holdings.length)}
            sub={totals.shares > 0 ? `${totals.shares.toFixed(2)} shares held` : 'signals owned'}
            icon={ReceiptText}
          />
          <StatTile
            label="Available to Trade"
            value={totals.rewards.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            valuePrefix="SF"
            sub="SignalFace balance"
            icon={Wallet}
          />
        </div>

        {/* My Signals */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold" style={{ color: DASH.ink }}>
              My Signals
            </h2>
            <NextLink
              href="/app/portfolio"
              className="text-sm font-medium hover:underline"
              style={{ color: DASH.magenta }}
            >
              View All
            </NextLink>
          </div>

          {mySignals.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-semibold" style={{ color: DASH.ink }}>
                You don&apos;t own any signals yet
              </p>
              <p className="mt-1 text-sm" style={{ color: DASH.inkMuted }}>
                Buy your first signal and it will show up here.
              </p>
              <NextLink
                href="/app/market"
                className="brand-gradient brand-glow inline-block mt-4 px-5 py-2 rounded-xl text-sm font-semibold text-white transition hover:brightness-110"
              >
                Explore the market
              </NextLink>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 lg:gap-4">
              {mySignals.slice(0, 4).map((s) => (
                <SignalMiniCard key={s.id} signal={s} />
              ))}
            </div>
          )}
        </div>

        {/* Activity + Top Gainers */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          <ActivityFeedCard entries={activity} />
          <TopGainersCard rows={topGainers} />
        </div>
      </div>
    </div>
  );
}
