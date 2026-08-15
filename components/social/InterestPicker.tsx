'use client';

import { Check } from 'lucide-react';
import { REALM_CATEGORIES, REALM_CATEGORY_LABELS, type RealmCategory } from '@/lib/api';

/** Matches the API's ArrayMaxSize — past this, everything matches and nothing ranks. */
export const MAX_INTERESTS = 10;

/**
 * The topic multi-select, shared by sign-up and settings so the two can't drift
 * apart. Uses the same vocabulary realms are categorised by, which is what lets
 * a chosen interest match a post's topic at all.
 */
export function InterestPicker({
  value,
  onChange,
  disabled,
}: {
  value: RealmCategory[];
  onChange: (next: RealmCategory[]) => void;
  disabled?: boolean;
}) {
  const toggle = (category: RealmCategory) => {
    if (value.includes(category)) {
      onChange(value.filter((c) => c !== category));
      return;
    }
    // Silently ignoring the tap past the cap would look broken, so the button
    // is disabled instead — see `atCap` below.
    if (value.length >= MAX_INTERESTS) return;
    onChange([...value, category]);
  };

  const atCap = value.length >= MAX_INTERESTS;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {REALM_CATEGORIES.map((category) => {
          const selected = value.includes(category);
          return (
            <button
              key={category}
              type="button"
              onClick={() => toggle(category)}
              disabled={disabled || (atCap && !selected)}
              aria-pressed={selected}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition
                disabled:opacity-40 disabled:cursor-not-allowed ${
                  selected
                    ? 'brand-gradient text-white'
                    : 'glass-chip text-foreground hover:brightness-125'
                }`}
            >
              {selected && <Check size={11} strokeWidth={3} />}
              {REALM_CATEGORY_LABELS[category]}
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        {value.length === 0
          ? 'Pick a few topics and your feed will lean towards them.'
          : `${value.length}/${MAX_INTERESTS} selected${atCap ? ' — that’s the maximum' : ''}`}
      </p>
    </div>
  );
}
