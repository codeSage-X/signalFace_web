'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Loader2,
  Plus,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { usd } from '@/components/dashboard/SignalMarketCard';
import { signalsApi, type SignalListItem } from '@/lib/api';
import { useToast } from '@/lib/stores';

const WATCHLIST_STORAGE_KEY = 'signalface.watchlist.signals';

const signalMatches = (signal: SignalListItem, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    signal.creatorName.toLowerCase().includes(q) ||
    signal.creatorUsername.toLowerCase().includes(q)
  );
};

const formatGrowth = (growthPct: string) => {
  const growth = Number(growthPct);
  if (!Number.isFinite(growth)) return '0.00%';
  return `${growth > 0 ? '+' : ''}${growth.toFixed(2)}%`;
};

const SignalRow = ({
  signal,
  action,
}: {
  signal: SignalListItem;
  action: React.ReactNode;
}) => {
  const growth = Number(signal.growthPct);
  const isRising = growth > 0;
  const Trend = isRising ? TrendingUp : TrendingDown;

  return (
    <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href={`/app/u/${signal.creatorUsername}`} className="flex items-center gap-3 min-w-0">
        <UserAvatar src={signal.creatorAvatarUrl} name={signal.creatorName} size="md" />
        <span className="min-w-0">
          <span className="block font-semibold text-card-foreground truncate">
            {signal.creatorName}
          </span>
          <span className="block text-sm text-muted-foreground truncate">
            @{signal.creatorUsername}
          </span>
        </span>
      </Link>

      <div className="grid grid-cols-3 gap-3 text-sm sm:min-w-[360px]">
        <div>
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="font-semibold text-primary">{usd(signal.price)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">24h</p>
          <p
            className={`font-semibold inline-flex items-center gap-1 ${
              isRising ? 'text-up' : growth < 0 ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            <Trend size={14} />
            {formatGrowth(signal.growthPct)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Users size={13} /> Holders
          </p>
          <p className="font-semibold text-card-foreground">
            {signal.holdersCount.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="sm:w-32 sm:flex-shrink-0">{action}</div>
    </div>
  );
};

export default function WatchlistPage() {
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [watchlistSignals, setWatchlistSignals] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (saved) setWatchlistSignals(new Set(JSON.parse(saved) as string[]));
    } catch {
      window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
    }
  }, []);

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

  const watchedSignals = useMemo(
    () => signals.filter((signal) => watchlistSignals.has(signal.id)),
    [signals, watchlistSignals],
  );

  const filteredWatchedSignals = useMemo(
    () => watchedSignals.filter((signal) => signalMatches(signal, search)),
    [watchedSignals, search],
  );

  const addableSignals = useMemo(
    () =>
      signals
        .filter((signal) => !watchlistSignals.has(signal.id))
        .filter((signal) => signalMatches(signal, search))
        .slice(0, 8),
    [signals, watchlistSignals, search],
  );

  const saveWatchlist = (next: Set<string>) => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([...next]));
  };

  const addSignal = (signal: SignalListItem) => {
    setWatchlistSignals((current) => {
      const next = new Set(current);
      next.add(signal.id);
      saveWatchlist(next);
      return next;
    });
    addToast({ message: `${signal.creatorName} added to your watchlist.`, type: 'success' });
  };

  const removeSignal = (signal: SignalListItem) => {
    setWatchlistSignals((current) => {
      const next = new Set(current);
      next.delete(signal.id);
      saveWatchlist(next);
      return next;
    });
    addToast({ message: `${signal.creatorName} removed from your watchlist.`, type: 'info' });
  };

  const focusSearch = () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Watchlist</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Track signals you want to follow before making an ownership move.
          </p>
        </div>

        <button
          type="button"
          onClick={focusSearch}
          className="inline-flex items-center justify-center gap-2 rounded-2xl brand-gradient px-4 py-3
            text-sm font-semibold text-white hover:brightness-110 transition sm:flex-shrink-0"
        >
          <Search size={17} />
          <Plus size={17} />
          Add Signal
        </button>
      </div>

      <div className="relative">
        <Search
          size={17}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search signals by creator name or handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-foreground placeholder-muted-foreground
            glass-card border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            Watched Signals ({watchlistSignals.size})
          </h2>
          {search && watchedSignals.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {filteredWatchedSignals.length} matching
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : watchedSignals.length === 0 ? (
          <div className="glass-dashed rounded-2xl p-8 sm:p-10 text-center">
            <Search size={26} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">No watched signals yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Search for a creator signal below and tap the plus icon to add it.
            </p>
          </div>
        ) : filteredWatchedSignals.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
            <p className="font-semibold text-card-foreground">No watched signals match that search</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try another creator name or handle.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredWatchedSignals.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                action={
                  <button
                    type="button"
                    onClick={() => removeSignal(signal)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl glass-chip px-3 py-2.5
                      text-sm font-semibold text-muted-foreground hover:text-destructive hover:brightness-125 transition"
                  >
                    <Trash2 size={16} />
                    Remove
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">Add Signals</h2>
          {!loading && <p className="text-xs text-muted-foreground">{signals.length} available</p>}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : addableSignals.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
            <Check size={26} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">
              {search ? 'No new signals match that search' : 'All available signals are watched'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? 'Try a different creator name or handle.' : 'New creator signals will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {addableSignals.map((signal) => (
              <SignalRow
                key={signal.id}
                signal={signal}
                action={
                  <button
                    type="button"
                    onClick={() => addSignal(signal)}
                    aria-label={`Add ${signal.creatorName} signal to watchlist`}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-3 py-2.5
                      text-sm font-semibold text-white hover:brightness-110 transition"
                  >
                    <Plus size={16} />
                    Add
                  </button>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
