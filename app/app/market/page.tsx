'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, TrendingUp, Loader2, LineChart } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  SignalMarketCard,
  compact,
} from '@/components/dashboard/SignalMarketCard';
import { marketApi, signalsApi, type MarketOverview, type SignalListItem } from '@/lib/api';
import { useToast } from '@/lib/stores';

export default function MarketPage() {
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([marketApi.getOverview(), signalsApi.list()])
      .then(([o, s]) => {
        if (cancelled) return;
        if (o.status === 'fulfilled') setOverview(o.value);
        if (s.status === 'fulfilled') setSignals(s.value);
        if (o.status === 'rejected' && s.status === 'rejected') {
          addToast({
            message: 'Could not load the market right now.',
            type: 'error',
            duration: 4000,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return signals;
    return signals.filter(
      (s) =>
        s.creatorName.toLowerCase().includes(q) ||
        s.creatorUsername.toLowerCase().includes(q),
    );
  }, [signals, search]);

  // Trading has no endpoint yet, so the button says so rather than failing
  // silently — same pattern as Top Up in the sidebar.
  const handleTrade = () =>
    addToast({ message: 'Trading is coming soon.', type: 'info', duration: 3000 });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Marketplace</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Explore and discover signals from top creators and communities.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Active Signals"
          value={overview?.totalSignals ?? signals.length}
          icon={TrendingUp}
        />
        <StatCard label="Market Cap" value={compact(overview?.totalMarketValue ?? 0)} />
        <StatCard label="24h Volume" value={compact(overview?.tradingVolume24h ?? 0)} />
        <StatCard
          label="Traders"
          value={(overview?.activeTraders ?? 0).toLocaleString()}
        />
      </div>

      <div className="relative">
        <Search
          size={17}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search signals by creator name or handle…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-foreground placeholder-muted-foreground
            glass-card border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4">
          Available Signals
          {!loading && filtered.length !== signals.length && ` (${filtered.length})`}
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
            <LineChart size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">
              {search ? 'No signals match that search' : 'No signals listed yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search
                ? 'Try a different creator name or handle.'
                : 'A Signal is created when a creator is approved.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((signal) => (
              <SignalMarketCard key={signal.id} signal={signal} onTrade={handleTrade} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
