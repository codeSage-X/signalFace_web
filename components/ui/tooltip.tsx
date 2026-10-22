'use client';

/**
 * Tooltip: a short explanation shown on hover, keyboard focus, or tap.
 *
 *   <Tooltip content="Not eligible for this item">
 *     <button aria-disabled="true">Pay small small</button>
 *   </Tooltip>
 *
 *   <span>Item total <InfoTip content="Before any delivery charge." /></span>
 *
 * Built in-house rather than on Radix because Radix tooltips never open on
 * touch, and most of our users are on phones. The bubble is portalled to
 * <body> with fixed positioning so scrollable dialogs can't clip it, flips to
 * the opposite side when there's no room, and is clamped inside the viewport.
 *
 * On touch, a tap opens it only when the tap does nothing else (see `tapToOpen`).
 *
 * Disabled children: a `disabled` element swallows pointer events, so the
 * wrapper turns them off on disabled descendants and catches hover itself. For
 * keyboard users to reach it, prefer `aria-disabled="true"` over `disabled`.
 */

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const GAP = 8; // between the trigger and the bubble
const EDGE = 8; // closest the bubble may get to the viewport edge
const HOVER_DELAY_MS = 150; // hover only; focus and tap open at once

const OPPOSITE: Record<TooltipSide, TooltipSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function fits(side: TooltipSide, t: DOMRect, b: DOMRect) {
  switch (side) {
    case 'top': return t.top - GAP - b.height >= EDGE;
    case 'bottom': return t.bottom + GAP + b.height <= window.innerHeight - EDGE;
    case 'left': return t.left - GAP - b.width >= EDGE;
    case 'right': return t.right + GAP + b.width <= window.innerWidth - EDGE;
  }
}

function place(preferred: TooltipSide, t: DOMRect, b: DOMRect) {
  // Flip only when the other side actually has room; otherwise keep the preference and clamp.
  const side = fits(preferred, t, b) || !fits(OPPOSITE[preferred], t, b) ? preferred : OPPOSITE[preferred];
  const vertical = side === 'top' || side === 'bottom';
  const top = vertical
    ? (side === 'top' ? t.top - GAP - b.height : t.bottom + GAP)
    : t.top + t.height / 2 - b.height / 2;
  const left = vertical
    ? t.left + t.width / 2 - b.width / 2
    : (side === 'left' ? t.left - GAP - b.width : t.right + GAP);
  const clamp = (value: number, size: number, viewport: number) =>
    Math.min(Math.max(value, EDGE), Math.max(EDGE, viewport - size - EDGE));
  return { top: clamp(top, b.height, window.innerHeight), left: clamp(left, b.width, window.innerWidth) };
}

/** A tap on a live button or link is the action itself; don't also pop a tooltip over it. */
function tapIsAction(target: Element) {
  const control = target.closest('button, a[href], [role="button"], input, select, textarea');
  return Boolean(control && !control.matches(':disabled, [aria-disabled="true"]'));
}

function isKeyboardFocus(el: Element) {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}

export function Tooltip({
  content,
  children,
  side = 'top',
  disabled = false,
  tapToOpen,
  className,
  contentClassName,
}: {
  /** What the tooltip says. Falsy renders the children alone. */
  content: ReactNode;
  children: ReactNode;
  /** Preferred side; flips automatically when there isn't room. */
  side?: TooltipSide;
  disabled?: boolean;
  /**
   * Whether a tap (touch/pen) opens it. By default only when the tap does nothing
   * else: disabled or aria-disabled controls, plain text and hints. Live buttons
   * and links only show it on hover and keyboard focus.
   */
  tapToOpen?: boolean;
  /** Classes for the wrapper around the trigger, e.g. `flex w-full` for a full-width button. */
  className?: string;
  contentClassName?: string;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const active = open && !disabled && Boolean(content);

  const show = useCallback((delay = 0) => {
    clearTimeout(timer.current);
    if (delay) timer.current = setTimeout(() => setOpen(true), delay);
    else setOpen(true);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
    setCoords(null);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const reposition = useCallback(() => {
    const t = triggerRef.current?.getBoundingClientRect();
    const b = bubbleRef.current?.getBoundingClientRect();
    if (t && b) setCoords(place(side, t, b));
  }, [side]);

  // Measure after the hidden bubble renders, before paint, so it never flashes at 0,0.
  useLayoutEffect(() => {
    if (active) reposition();
  }, [active, content, reposition]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    const onOutside = (e: PointerEvent) => {
      if (!triggerRef.current?.contains(e.target as Node)) hide();
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onOutside);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [active, reposition, hide]);

  // Point the trigger at the bubble for screen readers.
  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { 'aria-describedby': active ? id : undefined })
    : children;

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-flex [&_:disabled]:pointer-events-none', className)}
        onPointerEnter={(e) => e.pointerType === 'mouse' && show(HOVER_DELAY_MS)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
        // Tap opens; tapping anywhere else closes it (see onOutside).
        onPointerUp={(e) => e.pointerType !== 'mouse' && (tapToOpen ?? !tapIsAction(e.target as Element)) && show()}
        // Keyboard focus only: a mouse click also focuses a button, and the hover already covers it.
        onFocus={(e) => isKeyboardFocus(e.target) && show()}
        onBlur={hide}
      >
        {trigger}
      </span>
      {active &&
        createPortal(
          <div
            ref={bubbleRef}
            id={id}
            role="tooltip"
            style={coords ?? { top: 0, left: 0, visibility: 'hidden' }}
            className={cn(
              'pointer-events-none fixed z-[1000] max-w-[260px] rounded-md bg-foreground px-3 py-1.5 text-center text-xs font-medium leading-snug text-background shadow-lg',
              'animate-in fade-in-0 zoom-in-95 duration-100',
              contentClassName,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}

/** A small ⓘ that explains the thing next to it, for labels such as fees, balances and totals. */
export function InfoTip({
  content,
  side = 'top',
  label = 'More info',
  size = 14,
  className,
}: {
  content: ReactNode;
  side?: TooltipSide;
  /** Screen-reader name for the icon button. */
  label?: string;
  size?: number;
  className?: string;
}) {
  return (
    <Tooltip content={content} side={side} tapToOpen>
      <button
        type="button"
        aria-label={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          className,
        )}
      >
        <Info size={size} />
      </button>
    </Tooltip>
  );
}
