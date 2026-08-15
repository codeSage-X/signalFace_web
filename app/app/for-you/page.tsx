'use client';

import { postsApi } from '@/lib/api';
import { ImmersiveFeed } from '@/components/feed/ImmersiveFeed';

const PAGE_SIZE = 6;

/**
 * The public feed. All the feed machinery lives in ImmersiveFeed, which the
 * profile also mounts over its grid to scroll one collection — the only thing
 * that differs between the two is which page-fetcher is handed in.
 */
export default function ForYouPage() {
  return <ImmersiveFeed fetchPage={(cursor) => postsApi.feed(cursor, PAGE_SIZE)} />;
}
