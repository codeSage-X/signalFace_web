'use client';

import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { ChevronDown, Eye, EyeOff } from 'lucide-react';
import { DASH } from './theme';
import type { SeriesPoint } from '@/lib/series';

export const RANGES = ['24H', '7D', '30D', 'ALL'] as const;
export type Range = (typeof RANGES)[number];

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * The hero value card. Used by the investor dashboard for portfolio value and by
 * the creator dashboard for total Signal value — same anatomy, different label,
 * so `label`/`hint` are parameterised rather than the card being duplicated.
 */
export const PortfolioValueCard = ({
  totalValue,
  changePct,
  series,
  range,
  onRangeChange,
  label = 'Portfolio Value',
  hint,
  changeAbs,
}: {
  totalValue: number;
  changePct: number;
  series: SeriesPoint[];
  range: Range;
  onRangeChange: (r: Range) => void;
  label?: string;
  /** Shown on an info affordance beside the label. */
  hint?: string;
  /**
   * The exact change in currency. Pass it when the caller knows it — deriving
   * it from `changePct` alone is off by the compounding, since the percentage is
   * relative to the prior value, not the current one.
   */
  changeAbs?: number;
}) => {
  const [hidden, setHidden] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rangeOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rangeRef.current?.contains(e.target as Node)) setRangeOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setRangeOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [rangeOpen]);

  const up = changePct >= 0;
  // Fall back to deriving it only when the caller has nothing better.
  const changeMagnitude = Math.abs(changeAbs ?? (totalValue * changePct) / 100);

  return (
    <div className="glass-card rounded-2xl p-5 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
        {/* Hero number */}
        <div className="min-w-0 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: DASH.inkMuted }}>
              {label}
            </span>
            {hint && (
              <span
                title={hint}
                aria-label={hint}
                className="flex items-center justify-center w-4 h-4 rounded-full border text-[9px] font-bold cursor-help"
                style={{ borderColor: DASH.chipBorder, color: DASH.inkMuted }}
              >
                i
              </span>
            )}
            <button
              onClick={() => setHidden((h) => !h)}
              aria-label={hidden ? `Show ${label}` : `Hide ${label}`}
              className="transition hover:opacity-70"
              style={{ color: DASH.inkMuted }}
            >
              {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>

          <p
            className="mt-1 text-3xl lg:text-[2.5rem] font-bold leading-tight tracking-tight"
            style={{ color: DASH.ink }}
          >
            {hidden ? '••••••' : money(totalValue)}
          </p>

          <p className="mt-1 text-sm">
            {/* The sign carries direction; colour is redundant reinforcement. */}
            <span className="font-semibold" style={{ color: up ? DASH.up : DASH.down }}>
              {up ? '+' : '−'}
              {money(changeMagnitude)} ({Math.abs(changePct).toFixed(2)}%)
            </span>{' '}
            <span style={{ color: DASH.inkMuted }}>Today</span>
          </p>
        </div>

        {/* Range filter + sparkline. One series, so no legend — the label names it. */}
        <div className="flex-1 min-w-0 flex flex-col items-stretch gap-1">
          <div className="relative self-end" ref={rangeRef}>
            <button
              onClick={() => setRangeOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={rangeOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition hover:brightness-125"
              style={{ backgroundColor: DASH.chip, borderColor: DASH.chipBorder, color: DASH.ink }}
            >
              {range}
              <ChevronDown size={13} style={{ color: DASH.inkMuted }} />
            </button>

            {rangeOpen && (
              <div
                role="listbox"
                className="absolute right-0 top-9 z-20 w-24 rounded-lg border py-1 shadow-2xl"
                style={{ backgroundColor: DASH.chip, borderColor: DASH.chipBorder }}
              >
                {RANGES.map((r) => (
                  <button
                    key={r}
                    role="option"
                    aria-selected={r === range}
                    onClick={() => {
                      onRangeChange(r);
                      setRangeOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-xs transition hover:brightness-150"
                    style={{ color: r === range ? DASH.magenta : DASH.inkMuted }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="h-[76px] lg:h-[88px] w-full">
            {series.length >= 2 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 4, right: 2, bottom: 0, left: 2 }}>
                  <defs>
                    <linearGradient id="pvStroke" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor={DASH.violet} />
                      <stop offset="100%" stopColor={DASH.magenta} />
                    </linearGradient>
                    <linearGradient id="pvFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={DASH.magenta} stopOpacity={0.26} />
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
                    formatter={(v) => [money(v as number), 'Value']}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="url(#pvStroke)"
                    strokeWidth={2}
                    fill="url(#pvFill)"
                    dot={false}
                    activeDot={{ r: 4, fill: DASH.magenta, stroke: DASH.card, strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs" style={{ color: DASH.inkFaint }}>
                  Not enough history to chart yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
