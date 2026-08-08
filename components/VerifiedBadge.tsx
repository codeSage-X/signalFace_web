'use client';

import { Check } from 'lucide-react';

/**
 * The approved-creator tick. A real icon rather than the "✓" character, which
 * renders at a different weight and baseline in every font on every platform.
 */
export const VerifiedBadge = ({ size = 16 }: { size?: number }) => (
  <span
    aria-label="Verified creator"
    title="Verified creator"
    className="brand-gradient rounded-full flex items-center justify-center flex-shrink-0"
    style={{ width: size, height: size }}
  >
    <Check size={Math.round(size * 0.62)} strokeWidth={3.5} className="text-white" />
  </span>
);
