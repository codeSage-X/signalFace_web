'use client';

import NextLink from 'next/link';
import { ShoppingBag, TrendingDown, UserPlus } from 'lucide-react';
import { DASH } from './theme';

export interface RealmActivityEntry {
  id: string;
  kind: 'follower' | 'buy' | 'sell';
  text: string;
  username: string;
  avatarUrl: string | null;
  /** Pre-signed, e.g. `+ 25.60 SF`. Null for events with no amount. */
  amount: string | null;
  at: string;
}

const ICONS = {
  follower: UserPlus,
  buy: ShoppingBag,
  sell: TrendingDown,
} as const;

const ICON_BG = {
  follower: DASH.iconIndigo,
  buy: DASH.iconPink,
  sell: DASH.iconAmber,
} as const;

function timeAgo(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Recent events on the creator's page and Signal. */
export const RealmActivityCard = ({ entries }: { entries: RealmActivityEntry[] }) => (
  <div className="glass-card rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold" style={{ color: DASH.ink }}>
        Recent Activity
      </h2>
      <NextLink
        href="/app/activity"
        className="text-sm font-medium hover:underline"
        style={{ color: DASH.magenta }}
      >
        View All
      </NextLink>
    </div>

    {entries.length === 0 ? (
      <p className="py-10 text-center text-sm" style={{ color: DASH.inkFaint }}>
        No activity on your realm yet.
      </p>
    ) : (
      <ul className="space-y-4">
        {entries.map((entry) => {
          const Icon = ICONS[entry.kind];
          const isUp = entry.kind === 'buy' || entry.kind === 'follower';

          return (
            <li key={entry.id} className="flex items-start gap-3">
              {/* Avatar where a person drove the event, with the event type as a
                  small badge; falls back to a bare icon tile with no avatar. */}
              <span className="relative flex-shrink-0">
                <span className="w-9 h-9 rounded-full overflow-hidden brand-gradient flex items-center justify-center text-xs font-bold text-white">
                  {entry.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={entry.avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    entry.username.charAt(0).toUpperCase()
                  )}
                </span>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: ICON_BG[entry.kind], outline: `2px solid ${DASH.card}` }}
                >
                  <Icon size={9} className="text-white" />
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug" style={{ color: DASH.ink }}>
                  {entry.text}
                </p>
                <p className="text-xs mt-0.5" style={{ color: DASH.inkFaint }}>
                  <NextLink href={`/app/u/${entry.username}`} className="hover:underline">
                    @{entry.username}
                  </NextLink>{' '}
                  · {timeAgo(entry.at)}
                </p>
              </div>

              {entry.amount && (
                <span
                  className="text-sm font-semibold flex-shrink-0 whitespace-nowrap"
                  style={{ color: isUp ? DASH.up : DASH.down }}
                >
                  {entry.amount}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
