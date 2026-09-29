'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function useMarketplacePage<T>(fetchPage: (cursor?: string) => Promise<{ items: T[]; nextCursor: string | null }>) {
  const [items, setItems] = useState<T[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const pendingMore = useRef(false);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const current = ++generation.current;
    setLoading(true); setLoadingMore(false); pendingMore.current = false;
    setError(''); setItems([]); setNextCursor(null);
    fetchPage().then((page) => {
      if (current !== generation.current) return;
      setItems(page.items); setNextCursor(page.nextCursor);
    }).catch((err) => {
      if (current === generation.current) setError(err instanceof Error ? err.message : 'Could not load results.');
    }).finally(() => { if (current === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [fetchPage, revision]);
  async function loadMore() {
    if (!nextCursor || pendingMore.current || loading) return;
    const current = generation.current;
    pendingMore.current = true; setLoadingMore(true); setError('');
    try {
      const page = await fetchPage(nextCursor);
      if (current !== generation.current) return;
      setItems((previous) => [...previous, ...page.items]); setNextCursor(page.nextCursor);
    } catch (err) { if (current === generation.current) setError(err instanceof Error ? err.message : 'Could not load more results.'); }
    finally { if (current === generation.current) { pendingMore.current = false; setLoadingMore(false); } }
  }
  return { items, loading, loadingMore, error, nextCursor, loadMore, refresh };
}
