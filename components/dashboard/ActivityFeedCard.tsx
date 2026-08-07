'use client';

import NextLink from 'next/link';
import { Gift, ShoppingBag, TrendingUp, UserPlus } from 'lucide-react';
import { DASH } from './theme';

export type ActivityKind = 'buy' | 'reward' | 'price' | 'referral';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  text: string;
  time: string;
  /** Pre-formatted, sign included — e.g. `− $25.00`, `+ 15.50 SF`. */
  amount: string;
  tone: 'up' | 'down';
}

const ICONS = {
  buy: ShoppingBag,
  reward: Gift,
  price: TrendingUp,
  referral: UserPlus,
} as const;

const ICON_BG = {
  buy: DASH.iconIndigo,
  reward: DASH.iconAmber,
  price: DASH.iconPink,
  referral: DASH.iconIndigo,
} as const;

export const ActivityFeedCard = ({ entries }: { entries: ActivityEntry[] }) => (
  <div className="glass-card rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold" style={{ color: DASH.ink }}>
        Activity Feed
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
      <p className="py-8 text-center text-sm" style={{ color: DASH.inkFaint }}>
        No activity yet.
      </p>
    ) : (
      <ul className="space-y-4">
        {entries.map((e) => {
          const Icon = ICONS[e.kind];
          return (
            <li key={e.id} className="flex items-start gap-3">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: ICON_BG[e.kind] }}
              >
                <Icon size={14} className="text-white" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug" style={{ color: DASH.ink }}>
                  {e.text}
                </p>
                <p className="text-xs mt-0.5" style={{ color: DASH.inkFaint }}>
                  {e.time}
                </p>
              </div>

              <span
                className="text-sm font-semibold flex-shrink-0 whitespace-nowrap"
                style={{ color: e.tone === 'up' ? DASH.up : DASH.down }}
              >
                {e.amount}
              </span>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
