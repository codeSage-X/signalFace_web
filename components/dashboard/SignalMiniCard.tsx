'use client';

import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { DASH } from './theme';
import type { SeriesPoint } from '@/lib/series';

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export interface MiniSignal {
  id: string;
  name: string;
  /** Secondary line under the name — username, or a category once the API has one. */
  meta: string;
  avatarUrl?: string | null;
  price: number;
  changePct: number;
  portfolioPct: number;
  series: SeriesPoint[];
}

export const SignalMiniCard = ({ signal }: { signal: MiniSignal }) => {
  const up = signal.changePct >= 0;
  const initial = signal.name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className="glass-violet glass-hover rounded-2xl p-4">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div
            className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundImage: `linear-gradient(135deg, ${DASH.violet}, ${DASH.magenta})` }}
          >
            {signal.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signal.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
            style={{ backgroundColor: DASH.magenta, borderColor: DASH.card }}
          />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: DASH.ink }}>
            {signal.name}
          </p>
          <p className="text-xs truncate" style={{ color: DASH.inkMuted }}>
            {signal.meta}
          </p>
        </div>
      </div>

      {/* Mini price line — magenta regardless of direction, so hue never encodes sign. */}
      <div className="mt-3 h-[54px] w-full">
        {signal.series.length >= 2 && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={signal.series} margin={{ top: 4, right: 2, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id={`ms-${signal.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={DASH.magenta} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={DASH.magenta} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <Tooltip
                cursor={{ stroke: DASH.chipBorder, strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: DASH.chip,
                  border: `1px solid ${DASH.chipBorder}`,
                  borderRadius: 10,
                  fontSize: 12,
                  color: DASH.ink,
                }}
                labelFormatter={() => ''}
                formatter={(v) => [money(v as number), 'Price']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={DASH.magenta}
                strokeWidth={2}
                fill={`url(#ms-${signal.id})`}
                dot={false}
                activeDot={{ r: 3.5, fill: DASH.magenta, stroke: DASH.card, strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Direct label for the change — sign first, colour second. */}
      <p className="text-right text-sm font-semibold" style={{ color: up ? DASH.up : DASH.down }}>
        {up ? '+' : '−'}
        {Math.abs(signal.changePct).toFixed(1)}%
      </p>

      <p className="mt-2 text-lg font-bold" style={{ color: DASH.ink }}>
        {money(signal.price)}
      </p>
      <p className="text-xs" style={{ color: DASH.inkMuted }}>
        {signal.portfolioPct.toFixed(1)}% of Portfolio
      </p>
    </div>
  );
};
