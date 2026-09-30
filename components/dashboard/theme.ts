/**
 * Dashboard colours reference the app theme in `globals.css`. CSS variables
 * work in inline styles and SVG fill/stroke attributes, so text, chart labels,
 * and control surfaces follow the selected theme together.
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
  bg: 'var(--background)',
  /** Default card surface. */
  card: 'var(--surface)',
  /** Slightly raised surface for tiles nested inside a card. */
  tile: 'var(--surface-raised)',
  border: 'var(--border)',
  /** Range chip / segmented control. */
  chip: 'var(--muted)',
  chipBorder: 'var(--border)',

  ink: 'var(--foreground)',
  inkMuted: 'var(--muted-foreground)',
  inkFaint: 'var(--muted-foreground)',

  /** The one series colour. */
  magenta: 'var(--magenta)',
  /** Left end of the hero sparkline gradient. */
  violet: 'var(--violet)',

  /** Status colours — signed values only. */
  up: 'var(--up)',
  down: 'var(--down)',

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
