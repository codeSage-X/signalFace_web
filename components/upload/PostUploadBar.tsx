'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Check, RotateCw, X } from 'lucide-react';
import { usePostUpload } from '@/lib/stores';

// Long enough to register as "done", short enough not to linger.
const SUCCESS_DISMISS_MS = 2200;

/**
 * Sending the bytes is the part we can measure, so it owns the first 80% of the
 * bar. The rest is the server writing to Cloudinary, which reports nothing.
 */
const UPLOAD_SHARE = 0.8;
/** Where the creep starts, and how far it may crawl before the server replies. */
const PROCESSING_FLOOR = 80;
const PROCESSING_CEILING = 99;
const TRICKLE_MS = 500;

/**
 * Publish progress, spanning the top of the app.
 *
 * The bar never claims to be finished before it is. Real byte progress fills it
 * to 80%; once every byte is sent the server is still transcoding with no number
 * to report, so it creeps a percent at a time towards 99 and only jumps to 100
 * when the post actually lands. Reaching 100% and then sitting there — which is
 * what a straight byte percentage did — reads as a hang.
 *
 * Mounted once in the layout rather than on the upload page, because the point
 * is that it outlives that page: the composer closes on Post and this keeps
 * reporting while the user browses.
 */
export function PostUploadBar() {
  const { status, percent, error, retry, clear } = usePostUpload();
  const [trickle, setTrickle] = useState(0);

  // Creep forward while the server works, so the bar keeps moving without
  // pretending to know how much is left.
  useEffect(() => {
    if (status !== 'processing') {
      setTrickle(0);
      return;
    }

    const id = setInterval(
      () => setTrickle((t) => Math.min(t + 1, PROCESSING_CEILING - PROCESSING_FLOOR)),
      TRICKLE_MS,
    );
    return () => clearInterval(id);
  }, [status]);

  // Success clears itself; failure stays until acted on.
  useEffect(() => {
    if (status !== 'done') return;
    const id = setTimeout(clear, SUCCESS_DISMISS_MS);
    return () => clearTimeout(id);
  }, [status, clear]);

  if (!status) return null;

  const failed = status === 'error';
  const done = status === 'done';

  const value = done
    ? 100
    : failed
      ? Math.max(Math.round(percent * UPLOAD_SHARE), 8)
      : status === 'processing'
        ? PROCESSING_FLOOR + trickle
        : Math.round(percent * UPLOAD_SHARE);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] pointer-events-none"
      role="progressbar"
      aria-valuenow={failed ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Publishing your post"
    >
      {/* Edge to edge across the viewport */}
      <div className="h-1 w-full bg-white/[0.07]">
        <div
          className={`h-full transition-[width] duration-500 ease-out ${
            failed ? 'bg-red-500' : done ? 'bg-emerald-500' : 'brand-gradient'
          }`}
          style={{
            width: `${value}%`,
            boxShadow: failed ? 'none' : '0 0 12px rgba(196,20,63,0.7)',
          }}
        />
      </div>

      {/* Percentage, directly under the line */}
      <div className="flex justify-center">
        <div
          className={`pointer-events-auto mt-2 flex items-center gap-2 px-3 py-1.5 rounded-full
            text-xs font-semibold shadow-lg backdrop-blur-md ring-1 ${
              failed
                ? 'bg-red-500/15 text-red-200 ring-red-500/30'
                : done
                  ? 'bg-emerald-500/15 text-emerald-200 ring-emerald-500/30'
                  : 'bg-black/75 text-white ring-white/10'
            }`}
        >
          {failed ? (
            <>
              <AlertCircle size={13} />
              <span className="max-w-[60vw] truncate">{error ?? 'Post failed'}</span>
              {retry && (
                <button
                  onClick={retry}
                  className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/25 hover:bg-red-500/40 transition"
                >
                  <RotateCw size={11} />
                  Retry
                </button>
              )}
              <button
                onClick={clear}
                aria-label="Dismiss"
                className="ml-0.5 text-red-200/70 hover:text-white transition"
              >
                <X size={13} />
              </button>
            </>
          ) : done ? (
            <>
              <Check size={13} strokeWidth={3} />
              Posted
            </>
          ) : (
            <span className="tabular-nums">{value}%</span>
          )}
        </div>
      </div>
    </div>
  );
}
