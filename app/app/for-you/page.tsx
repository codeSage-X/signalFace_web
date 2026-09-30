'use client';

import { postsApi } from '@/lib/api';
import { ImmersiveFeed } from '@/components/feed/ImmersiveFeed';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const PAGE_SIZE = 6;

/**
 * The public feed. All the feed machinery lives in ImmersiveFeed, which the
 * profile also mounts over its grid to scroll one collection — the only thing
 * that differs between the two is which page-fetcher is handed in.
 */
function ForYouFeed() {
  const postId = useSearchParams().get('post');
  return <ImmersiveFeed key={postId ?? 'feed'} fetchPage={async (cursor) => {
    if (cursor || !postId) return postsApi.feed(cursor, PAGE_SIZE);
    const post = await postsApi.getOne(postId);
    try {
      const page = await postsApi.feed(null, PAGE_SIZE);
      return { ...page, items: [post, ...page.items.filter((item) => item.id !== post.id)] };
    } catch {
      // A feed failure must not prevent opening a valid shared post.
      return { items: [post], nextCursor: null };
    }
  }} />;
}

export default function ForYouPage() {
  return <Suspense fallback={<div role="status" className="p-6 text-center text-muted-foreground">Loading post…</div>}><ForYouFeed /></Suspense>;
}
