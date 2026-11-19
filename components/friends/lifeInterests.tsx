'use client';

import { Heart, Users } from 'lucide-react';
import type { LifeInterest } from '@/lib/api';

type IconProps = { className?: string };

/** Two interlocking rings — lucide has no wedding-ring glyph. */
export function RingsIcon({ className, gem = false }: IconProps & { gem?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="9" cy="14" r="5.5" />
      <circle cx="15" cy="14" r="5.5" />
      {gem && <path d="M10.5 5.5 12 3.5l1.5 2L12 7.5z" fill="currentColor" />}
    </svg>
  );
}

export type LifeFilter = 'ALL' | LifeInterest;

/** The four interests — same names, icons and order as the Life Connections cards. */
export const LIFE_INTEREST_OPTIONS: {
  value: LifeInterest;
  label: string;
  icon: (p: IconProps) => React.ReactElement;
}[] = [
  { value: 'MEANINGFUL_CONNECTIONS', label: 'Meaningful Connections', icon: (p) => <Users {...p} /> },
  { value: 'DATING', label: 'Dating', icon: (p) => <Heart {...p} /> },
  { value: 'LIFE_PARTNER', label: 'Life Partner', icon: (p) => <RingsIcon {...p} /> },
  { value: 'MARRIAGE_INTENTIONS', label: 'Marriage Intentions', icon: (p) => <RingsIcon gem {...p} /> },
];

/** Multi-select used by onboarding and Settings, so the two can't drift apart. */
export function LifeInterestPicker({
  value,
  onChange,
  disabled,
}: {
  value: LifeInterest[];
  onChange: (next: LifeInterest[]) => void;
  disabled?: boolean;
}) {
  const toggle = (v: LifeInterest) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {LIFE_INTEREST_OPTIONS.map(({ value: v, label, icon: Icon }) => {
        const selected = value.includes(v);
        return (
          <button
            key={v}
            type="button"
            onClick={() => toggle(v)}
            disabled={disabled}
            aria-pressed={selected}
            className={`flex items-center gap-2.5 rounded-xl px-3 py-3 text-sm font-semibold text-left transition disabled:opacity-60 ${
              selected
                ? 'brand-gradient text-white shadow-md'
                : 'glass-chip text-foreground hover:brightness-125'
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                selected ? 'bg-white/20' : 'bg-primary/15 text-primary'
              }`}
            >
              <Icon className="h-4 w-4" />
            </span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
