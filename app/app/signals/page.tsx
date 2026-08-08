'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, LineChart } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';
import { SignalMarketCard, money } from '@/components/dashboard/SignalMarketCard';
import { signalsApi, type SignalListItem } from '@/lib/api';
import { useToast } from '@/lib/stores';

export default function SignalsPage() {
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;

    signalsApi
      .list()
      .then((items) => {
        if (!cancelled) setSignals(items);
      })
      .catch((err) => {
        if (cancelled) return;
        addToast({
          message: err instanceof Error ? err.message : 'Could not load signals.',
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast]);

  // Derived from the real list rather than invented: `/signals` comes back
  // ordered by price descending, so first and last bound the range.
  const stats = useMemo(() => {
    if (signals.length === 0) {
      return { count: 0, avg: 0, holders: 0, range: '—' };
    }
    const prices = signals.map((s) => Number(s.price)).filter(Number.isFinite);
    const avg = prices.reduce((a, b) => a + b, 0) / (prices.length || 1);
    const holders = signals.reduce((a, s) => a + s.holdersCount, 0);
    const low = Math.min(...prices);
    const high = Math.max(...prices);

    return {
      count: signals.length,
      avg,
      holders,
      range: low === high ? money(low) : `${money(low)} – ${money(high)}`,
    };
  }, [signals]);

  const handleTrade = () =>
    addToast({ message: 'Trading is coming soon.', type: 'info', duration: 3000 });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Signal Explorer</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Browse all available signals and discover new investment opportunities.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Signals" value={stats.count} />
        <StatCard label="Avg Price" value={money(stats.avg)} />
        <StatCard label="Total Holders" value={stats.holders.toLocaleString()} />
        <StatCard label="Price Range" value={stats.range} />
      </div>

      <div>
        <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4">
          All Available Signals
        </h2>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : signals.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
            <LineChart size={28} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">No signals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              A Signal is created when a creator is approved.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {signals.map((signal) => (
              <SignalMarketCard key={signal.id} signal={signal} onTrade={handleTrade} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
