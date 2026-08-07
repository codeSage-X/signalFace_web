'use client';

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { DASH } from './theme';

/**
 * Holder-concentration ramp.
 *
 * These bands are **ordinal**, not categorical — "Top 10%" through "60–100%" is
 * a sequence, and swapping two of them would change the meaning. So the encoding
 * is a single magenta hue stepped light→dark, which shows the order in the
 * colour, rather than four unrelated hues.
 *
 * Validated with the dataviz palette checker against this surface (#12101A):
 * adjacent CVD ΔE 10.9 (deuteranopia) and normal-vision ΔE 15.2, both clear of
 * the floors, with monotone lightness 0.78 → 0.68 → 0.49 → 0.36. The two darkest
 * steps sit under 3:1 on the surface, which the checker flags as needing relief —
 * hence the percentage printed on every legend row, never colour alone.
 */
const BAND_RAMP = ['#FF8CC8', '#FF2D9B', '#B01A6B', '#6B1043'] as const;

export interface DistributionBand {
  label: string;
  holders: number;
  sharePct: number;
}

export const HoldersDistributionCard = ({
  bands,
  totalHolders,
}: {
  bands: DistributionBand[];
  totalHolders: number;
}) => {
  const hasData = totalHolders > 0 && bands.some((b) => b.sharePct > 0);

  return (
    <div className="glass-card rounded-2xl p-5">
      <h2 className="text-base font-bold mb-4" style={{ color: DASH.ink }}>
        Holders Distribution
      </h2>

      {!hasData ? (
        <div className="py-14 text-center">
          <p className="text-sm font-semibold" style={{ color: DASH.ink }}>
            No holders yet
          </p>
          <p className="mt-1 text-sm" style={{ color: DASH.inkMuted }}>
            Once fans buy your Signal, you&apos;ll see how concentrated your
            holder base is here.
          </p>
        </div>
      ) : (
        <>
          <div className="relative h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={bands}
                  dataKey="sharePct"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="92%"
                  startAngle={90}
                  endAngle={-270}
                  // A 2px surface-coloured ring plus a small gap keeps adjacent
                  // bands legible where their lightness steps are closest.
                  paddingAngle={2}
                  stroke={DASH.card}
                  strokeWidth={2}
                >
                  {bands.map((band, i) => (
                    <Cell key={band.label} fill={BAND_RAMP[i % BAND_RAMP.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: DASH.chip,
                    border: `1px solid ${DASH.chipBorder}`,
                    borderRadius: 10,
                    fontSize: 12,
                    color: DASH.ink,
                  }}
                  formatter={(value, name) => [`${value}% of supply`, name as string]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centre label — the headline the ring is a breakdown of. */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold" style={{ color: DASH.ink }}>
                {totalHolders.toLocaleString()}
              </span>
              <span className="text-xs" style={{ color: DASH.inkMuted }}>
                Total
              </span>
            </div>
          </div>

          {/* Legend doubles as the table view: every row carries its own value,
              so identity never rests on colour alone. */}
          <ul className="mt-4 space-y-2.5">
            {bands.map((band, i) => (
              <li key={band.label} className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: BAND_RAMP[i % BAND_RAMP.length] }}
                />
                <span className="flex-1 text-sm truncate" style={{ color: DASH.inkMuted }}>
                  {band.label}
                </span>
                <span className="text-xs tabular-nums" style={{ color: DASH.inkFaint }}>
                  {band.holders} {band.holders === 1 ? 'holder' : 'holders'}
                </span>
                <span
                  className="text-sm font-semibold tabular-nums w-14 text-right"
                  style={{ color: DASH.ink }}
                >
                  {band.sharePct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
