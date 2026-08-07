/**
 * Deterministic price-series helpers.
 *
 * The API has no per-signal or per-portfolio price-history endpoint yet, so the
 * sparklines synthesise a walk that lands on the real current value and starts
 * from the real prior value. It must be deterministic: `Math.random()` would
 * produce different numbers on the server and the client and blow up hydration.
 */

/** mulberry32 — small, fast, seeded PRNG. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface SeriesPoint {
  label: string;
  value: number;
}

/**
 * A jittered walk from `startValue` to `endValue` over `points` samples.
 * The first and last samples are exact; only the interior is synthesised.
 */
export function syntheticSeries(
  seed: string,
  points: number,
  startValue: number,
  endValue: number,
): SeriesPoint[] {
  const rand = mulberry32(hashSeed(seed));
  const span = Math.max(Math.abs(endValue - startValue), Math.abs(endValue) * 0.08, 0.01);

  return Array.from({ length: points }, (_, i) => {
    const t = points === 1 ? 1 : i / (points - 1);
    const trend = startValue + (endValue - startValue) * t;
    // Taper the noise to zero at both ends so the endpoints stay truthful.
    const taper = Math.sin(Math.PI * t);
    const value = trend + (rand() - 0.5) * span * 0.55 * taper;

    return {
      label: `${points - i}`,
      value: Number(Math.max(value, 0).toFixed(2)),
    };
  });
}
