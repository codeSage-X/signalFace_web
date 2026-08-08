'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, Users } from 'lucide-react';
import { signalsApi, type SignalListItem } from '@/lib/api';
import { useToast } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';

const money = (raw: string) => {
  const n = Number(raw);
  return Number.isFinite(n)
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
};

const growth = (raw: string) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return { label: '—', tone: 'text-muted-foreground' };
  const sign = n > 0 ? '+' : '';
  return {
    label: `${sign}${n.toFixed(2)}%`,
    // Flat is the common case until scoring runs, and it shouldn't read as a loss.
    tone: n > 0 ? 'text-emerald-400' : n < 0 ? 'text-destructive' : 'text-muted-foreground',
  };
};

export default function CreatorsPage() {
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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
          message: err instanceof Error ? err.message : 'Could not load creators.',
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

  // `/signals` returns the full approved-creator list, so filtering client-side
  // avoids a round trip per keystroke.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return signals;
    return signals.filter(
      (s) =>
        s.creatorName.toLowerCase().includes(q) ||
        s.creatorUsername.toLowerCase().includes(q),
    );
  }, [signals, search]);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Top Creators</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Invest in your favorite creators and watch them grow.
      </p>

      <div className="relative mt-6 mb-6">
        <Search
          size={17}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search creators by name or handle…"
          className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-foreground placeholder-muted-foreground
            glass-card border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Users size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">
            {search ? 'No creators match that search' : 'No creators yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {search
              ? 'Try a different name or handle.'
              : 'Approved creators appear here once they have a Signal.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const g = growth(s.growthPct);
            return (
              <div
                key={s.id}
                className="glass-card glass-hover rounded-2xl p-4 sm:p-5 flex flex-col"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Link href={`/app/u/${s.creatorUsername}`} className="flex-shrink-0">
                    <UserAvatar src={s.creatorAvatarUrl} name={s.creatorName} size="md" />
                  </Link>
                  <Link href={`/app/u/${s.creatorUsername}`} className="min-w-0">
                    <p className="font-semibold text-card-foreground truncate flex items-center gap-1.5">
                      <span className="truncate">{s.creatorName}</span>
                      <span className="w-4 h-4 brand-gradient rounded-full flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">
                        ✓
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      @{s.creatorUsername}
                    </p>
                  </Link>
                </div>

                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Signal Price</dt>
                    <dd className="font-bold text-primary">{money(s.price)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">24h Change</dt>
                    <dd className={`font-semibold ${g.tone}`}>{g.label}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <dt className="text-muted-foreground">Holders</dt>
                    <dd className="font-semibold text-card-foreground">
                      {s.holdersCount.toLocaleString()}
                    </dd>
                  </div>
                </dl>

                <div className="mt-4 pt-4 border-t border-white/[0.06]">
                  <Link
                    href={`/app/u/${s.creatorUsername}`}
                    className="block w-full text-center px-4 py-2.5 rounded-xl brand-gradient
                      text-white text-sm font-semibold hover:brightness-110 transition"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
