'use client';

import NextLink from 'next/link';
import { DASH } from './theme';

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface GainerRow {
  id: string;
  name: string;
  meta: string;
  avatarUrl?: string | null;
  price: number;
  changePct: number;
  href?: string;
}

export const TopGainersCard = ({ rows }: { rows: GainerRow[] }) => (
  <div className="glass-card rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold" style={{ color: DASH.ink }}>
        Top Gainers
      </h2>
      <NextLink
        href="/app/market"
        className="text-sm font-medium hover:underline"
        style={{ color: DASH.magenta }}
      >
        View All
      </NextLink>
    </div>

    {rows.length === 0 ? (
      <p className="py-8 text-center text-sm" style={{ color: DASH.inkFaint }}>
        No signals are trading yet.
      </p>
    ) : (
      <ul className="space-y-3.5">
        {rows.map((r) => {
          const up = r.changePct >= 0;
          const initial = r.name.trim().charAt(0).toUpperCase() || '?';

          const row = (
            <>
              <div
                className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{
                  backgroundImage: `linear-gradient(135deg, ${DASH.violet}, ${DASH.magenta})`,
                }}
              >
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initial
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate" style={{ color: DASH.ink }}>
                  {r.name}
                </p>
                <p className="text-xs truncate" style={{ color: DASH.inkMuted }}>
                  {r.meta}
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold" style={{ color: up ? DASH.up : DASH.down }}>
                  {up ? '+' : '−'}
                  {Math.abs(r.changePct).toFixed(1)}%
                </p>
                <p className="text-xs" style={{ color: DASH.inkMuted }}>
                  {money(r.price)}
                </p>
              </div>
            </>
          );

          return (
            <li key={r.id}>
              {r.href ? (
                <NextLink
                  href={r.href}
                  className="flex items-center gap-3 rounded-lg transition hover:brightness-125"
                >
                  {row}
                </NextLink>
              ) : (
                <div className="flex items-center gap-3">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </div>
);
