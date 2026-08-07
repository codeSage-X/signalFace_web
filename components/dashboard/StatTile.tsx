'use client';

import type { LucideIcon } from 'lucide-react';
import { DASH } from './theme';

/**
 * A KPI tile: label, optional corner icon, hero value, optional sub-line.
 * No plot, so no hover layer — the value is already the whole message.
 */
export const StatTile = ({
  label,
  value,
  valuePrefix,
  sub,
  tone = 'neutral',
  subTone = 'muted',
  icon: Icon,
}: {
  label: string;
  value: string;
  /** Rendered small and magenta before the value, e.g. the `SF` unit. */
  valuePrefix?: string;
  sub?: string;
  tone?: 'neutral' | 'up' | 'down';
  subTone?: 'muted' | 'up' | 'down';
  icon?: LucideIcon;
}) => {
  const toneColor =
    tone === 'up' ? DASH.up : tone === 'down' ? DASH.down : DASH.ink;
  const subColor =
    subTone === 'up' ? DASH.up : subTone === 'down' ? DASH.down : DASH.inkMuted;

  return (
    <div className="glass-card rounded-2xl p-4 lg:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.8rem]" style={{ color: DASH.inkMuted }}>
          {label}
        </p>
        {Icon && <Icon size={14} style={{ color: DASH.inkFaint }} className="flex-shrink-0" />}
      </div>

      <p className="mt-2 text-xl lg:text-2xl font-bold tracking-tight" style={{ color: toneColor }}>
        {valuePrefix && (
          <span className="text-sm font-semibold mr-1" style={{ color: DASH.magenta }}>
            {valuePrefix}
          </span>
        )}
        {value}
      </p>

      {sub && (
        <p className="mt-1.5 text-xs" style={{ color: subColor }}>
          {sub}
        </p>
      )}
    </div>
  );
};
