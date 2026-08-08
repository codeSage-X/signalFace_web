'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Users } from 'lucide-react';
import type { SignalListItem } from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';

export const money = (raw: string | number) => {
  const n = Number(raw);
  return Number.isFinite(n)
    ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '—';
};

export const compact = (raw: string | number) => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '—';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return money(n);
};

/**
 * One tradable Signal, as `/signals` actually returns it. A Signal belongs to a
 * creator — there are no product tiers — so the card leads with the person.
 */
export const SignalMarketCard = ({
  signal,
  onTrade,
}: {
  signal: SignalListItem;
  onTrade?: (signal: SignalListItem) => void;
}) => {
  const change = Number(signal.growthPct);
  const rising = change > 0;
  const falling = change < 0;
  const Trend = rising ? TrendingUp : falling ? TrendingDown : Minus;

  return (
    <div className="glass-card glass-hover rounded-2xl p-4 sm:p-5 flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/app/u/${signal.creatorUsername}`}
          className="flex items-center gap-3 min-w-0"
        >
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

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-muted-foreground">Current Price</p>
          <p className="text-lg font-bold text-primary">{money(signal.price)}</p>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">24h Change</dt>
          <dd
            className={`font-semibold inline-flex items-center gap-1 ${
              rising ? 'text-up' : falling ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            <Trend size={14} />
            {rising ? '+' : ''}
            {Number.isFinite(change) ? change.toFixed(2) : '0.00'}%
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground">Pulse Score</dt>
          <dd className="font-semibold text-card-foreground">
            {Number(signal.score).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-muted-foreground inline-flex items-center gap-1.5">
            <Users size={13} /> Holders
          </dt>
          <dd className="font-semibold text-card-foreground">
            {signal.holdersCount.toLocaleString()}
          </dd>
        </div>
      </dl>

      <div className="mt-4 pt-4 border-t border-white/[0.06] flex gap-2">
        <Link
          href={`/app/u/${signal.creatorUsername}`}
          className="flex-1 text-center px-4 py-2.5 rounded-xl glass-chip text-sm font-medium
            text-foreground hover:brightness-125 transition"
        >
          View Creator
        </Link>
        {onTrade && (
          <button
            onClick={() => onTrade(signal)}
            className="flex-1 px-4 py-2.5 rounded-xl brand-gradient text-white text-sm
              font-semibold hover:brightness-110 transition"
          >
            Buy Signal
          </button>
        )}
      </div>
    </div>
  );
};
