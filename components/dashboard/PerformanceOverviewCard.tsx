'use client';

import NextLink from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DASH } from './theme';

export const PERF_RANGES = ['7D', '30D', '90D', '1Y'] as const;
export type PerfRange = (typeof PERF_RANGES)[number];

export interface PerfPoint {
  /** ISO timestamp of the snapshot. */
  date: string;
  value: number;
}

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Axis ticks stay terse — `$140`, not `$140.00`. */
const axisMoney = (n: number) => `$${Math.round(n)}`;

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * Signal price over time. One series, so no legend — the heading names it — and
 * the line is magenta whether the price rose or fell, per the palette rule that
 * hue never encodes direction.
 */
export const PerformanceOverviewCard = ({
  points,
  range,
  onRangeChange,
}: {
  points: PerfPoint[];
  range: PerfRange;
  onRangeChange: (r: PerfRange) => void;
}) => (
  <div className="glass-card rounded-2xl p-5">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold" style={{ color: DASH.ink }}>
        Performance Overview
      </h2>
      <NextLink
        href="/app/market"
        className="text-sm font-medium hover:underline"
        style={{ color: DASH.magenta }}
      >
        View Analytics
      </NextLink>
    </div>

    {/* Range filter sits in one row above the plot. */}
    <div
      role="group"
      aria-label="Chart range"
      className="inline-flex items-center gap-1 p-1 rounded-full mb-4"
      style={{ backgroundColor: DASH.chip }}
    >
      {PERF_RANGES.map((r) => (
        <button
          key={r}
          onClick={() => onRangeChange(r)}
          aria-pressed={r === range}
          className="px-4 py-1.5 rounded-full text-xs font-semibold transition"
          style={
            r === range
              ? { backgroundColor: DASH.magenta, color: '#FFFFFF' }
              : { color: DASH.inkMuted }
          }
        >
          {r}
        </button>
      ))}
    </div>

    <div className="h-56 lg:h-64 w-full">
      {points.length >= 2 ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: -8 }}>
            <defs>
              <linearGradient id="perfStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={DASH.violet} />
                <stop offset="100%" stopColor={DASH.magenta} />
              </linearGradient>
              <linearGradient id="perfFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={DASH.magenta} stopOpacity={0.28} />
                <stop offset="100%" stopColor={DASH.magenta} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Recessive grid: horizontal only, so it reads as a reference and
                not as a cage around the data. */}
            <CartesianGrid
              horizontal
              vertical={false}
              stroke={DASH.border}
              strokeDasharray="3 3"
            />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tick={{ fill: DASH.inkFaint, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={28}
            />
            <YAxis
              tickFormatter={axisMoney}
              tick={{ fill: DASH.inkFaint, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: DASH.chipBorder, strokeWidth: 1 }}
              contentStyle={{
                backgroundColor: DASH.chip,
                border: `1px solid ${DASH.chipBorder}`,
                borderRadius: 10,
                fontSize: 12,
                color: DASH.ink,
              }}
              labelFormatter={(label) =>
                new Date(label as string).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              }
              formatter={(v) => [money(v as number), 'Signal price']}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="url(#perfStroke)"
              strokeWidth={2}
              fill="url(#perfFill)"
              dot={false}
              activeDot={{ r: 4, fill: DASH.magenta, stroke: DASH.card, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm font-semibold" style={{ color: DASH.ink }}>
            Not enough price history yet
          </p>
          <p className="mt-1 text-sm" style={{ color: DASH.inkMuted }}>
            Your Signal is scored on a schedule — the chart fills in as snapshots
            accumulate over this range.
          </p>
        </div>
      )}
    </div>
  </div>
);
