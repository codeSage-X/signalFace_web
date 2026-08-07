/**
 * The app palette, as literals.
 *
 * These are the same values as the dark-mode tokens in `globals.css` — that file
 * is the source of truth and this is its mirror, kept because SVG presentation
 * attributes (recharts `stroke`, `fill`) don't resolve `var()`. Anything that
 * *can* use a token or a Tailwind class should: `text-foreground`, `text-up`,
 * `bg-surface`, `.glass-card`. Reach for DASH only for chart internals.
 *
 * If you change a value here, change it in `globals.css` too.
 *
 * Colour rules this palette is built to:
 *  - MAGENTA is the only series colour. Every price line — rising or falling —
 *    is magenta, so hue never encodes direction.
 *  - UP/DOWN are status colours, reserved for signed values. They are always
 *    rendered next to a `+`/`−` sign, never as the sole carrier of polarity
 *    (the green/down pair sits in the CVD floor band, so the sign is required).
 *  - Text always wears an ink colour, never a series colour.
 */
export const DASH = {
  /** Page backdrop. */
  bg: '#08060C',
  /** Default card surface. */
  card: '#12101A',
  /** Slightly raised surface for tiles nested inside a card. */
  tile: '#161220',
  border: '#221E2C',
  /** Range chip / segmented control. */
  chip: '#1B1724',
  chipBorder: '#2A2536',

  ink: '#F7F5FA',
  inkMuted: '#8C879A',
  inkFaint: '#655F73',

  /** The one series colour. */
  magenta: '#FF2D9B',
  /** Left end of the hero sparkline gradient. */
  violet: '#A855F7',

  /** Status colours — signed values only. */
  up: '#4ADE80',
  down: '#F87171',

  /** Activity-row icon backgrounds. */
  iconIndigo: '#4F46E5',
  iconAmber: '#B45309',
  iconPink: '#EC4899',
} as const;

/*
 * The glass surfaces this screen used to define locally now live in
 * `globals.css` as the app-wide `.glass-card` / `.glass-tile` / `.glass-brand`
 * family — use those classes instead of a style object.
 */
