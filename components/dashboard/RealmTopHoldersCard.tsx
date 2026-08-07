'use client';

import NextLink from 'next/link';
import { DASH } from './theme';

export interface HolderRow {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  shares: string;
  value: string;
  sharePct: number;
}

/** Who holds the creator's Signal, largest position first. */
export const RealmTopHoldersCard = ({ holders }: { holders: HolderRow[] }) => (
  <div className="glass-card rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold" style={{ color: DASH.ink }}>
        Top Holders
      </h2>
      <NextLink
        href="/app/market"
        className="text-sm font-medium hover:underline"
        style={{ color: DASH.magenta }}
      >
        View All
      </NextLink>
    </div>

    {holders.length === 0 ? (
      <p className="py-10 text-center text-sm" style={{ color: DASH.inkFaint }}>
        Nobody holds your Signal yet.
      </p>
    ) : (
      <ol className="space-y-3.5">
        {holders.map((holder, i) => (
          <li key={holder.userId} className="flex items-center gap-3">
            <span
              className="w-4 text-sm font-semibold tabular-nums flex-shrink-0"
              style={{ color: DASH.inkFaint }}
            >
              {i + 1}
            </span>

            <NextLink
              href={`/app/u/${holder.username}`}
              className="w-9 h-9 rounded-full overflow-hidden brand-gradient flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            >
              {holder.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={holder.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                holder.displayName.charAt(0).toUpperCase()
              )}
            </NextLink>

            <div className="min-w-0 flex-1">
              <NextLink
                href={`/app/u/${holder.username}`}
                className="block text-sm font-semibold truncate hover:underline"
                style={{ color: DASH.ink }}
              >
                @{holder.username}
              </NextLink>
              <p className="text-xs" style={{ color: DASH.inkFaint }}>
                {holder.shares} shares · ${holder.value}
              </p>
            </div>

            <span
              className="text-sm font-semibold tabular-nums flex-shrink-0"
              style={{ color: DASH.ink }}
            >
              {holder.sharePct.toFixed(2)}%
            </span>
          </li>
        ))}
      </ol>
    )}
  </div>
);
