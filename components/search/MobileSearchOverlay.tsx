'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SearchPage from '@/app/app/search/page';

/**
 * The drawer opens this with a history entry, so the browser back gesture and
 * the search page's existing back button both return to the page underneath.
 * The route page is rendered here instead of duplicating its search state,
 * results, suggestions, and result viewer.
 */
export function MobileSearchOverlay() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get('search') === '1';

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') router.back();
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, router]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 overflow-y-auto bg-background pt-[env(safe-area-inset-top)] lg:hidden"
    >
      <SearchPage />
    </div>
  );
}
