'use client';

import NextLink from 'next/link';
import { Eye, FileText, Image as ImageIcon, LayoutGrid, Loader2, Play } from 'lucide-react';
import type { FeedPost } from '@/lib/api';

/** Deterministic per-position gradient — `Math.random()` would break hydration. */
const CARD_GRADIENTS = [
  'from-[#3B0B57] to-[#1A1424]',
  'from-[#5B1B6B] to-[#2A1B36]',
  'from-[#8E1030] to-[#1A1424]',
  'from-[#C4143F] to-[#3B0B57]',
  'from-[#2A1B36] to-[#12101A]',
];

/**
 * The tiled post grid used by realm pages. Read-only: realm posts are managed
 * from the owner's personal grid, which already carries pin and delete.
 */
export const RealmPostGrid = ({
  posts,
  loading,
  nextCursor,
  loadingMore,
  onLoadMore,
  emptyTitle,
  emptyBody,
  emptyAction,
}: {
  posts: FeedPost[];
  loading: boolean;
  nextCursor: string | null;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyTitle: string;
  emptyBody: string;
  emptyAction?: { href: string; label: string };
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-lg aspect-[9/16] bg-white/[0.06] animate-pulse" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
          <LayoutGrid size={24} className="text-muted-foreground" />
        </div>
        <p className="text-foreground font-semibold">{emptyTitle}</p>
        <p className="text-muted-foreground text-sm mt-1 mb-4 max-w-sm">{emptyBody}</p>
        {emptyAction && (
          <NextLink
            href={emptyAction.href}
            className="px-5 py-2 rounded-xl font-semibold text-white text-sm brand-gradient hover:brightness-110 transition"
          >
            {emptyAction.label}
          </NextLink>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {posts.map((post, i) => (
          <Tile key={post.id} post={post} index={i} />
        ))}
      </div>

      {nextCursor && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium py-4 hover:underline disabled:opacity-60"
        >
          {loadingMore && <Loader2 size={14} className="animate-spin" />}
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
};

const Tile = ({ post, index }: { post: FeedPost; index: number }) => {
  const { kind, body, mediaUrls, viewCount, pinned } = post;
  const preview = mediaUrls[0];
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];

  return (
    <div className="relative group rounded-lg overflow-hidden aspect-[9/16] bg-gradient-to-br from-[#1A1424] to-[#12101A]">
      {kind === 'image' && preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : kind === 'video' && preview ? (
        <video
          src={preview}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-60`} />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <p className="text-white text-xs font-semibold text-center leading-tight line-clamp-6 drop-shadow">
              {body}
            </p>
          </div>
        </>
      )}

      {pinned && (
        <div className="absolute top-2 left-2 brand-gradient text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Pinned
        </div>
      )}

      <div className="absolute top-2 right-2 text-white/80 drop-shadow">
        {kind === 'video' && <Play size={12} fill="currentColor" />}
        {kind === 'image' && <ImageIcon size={12} />}
        {kind === 'text' && <FileText size={12} />}
      </div>

      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs drop-shadow">
        {kind === 'video' ? <Play size={10} fill="white" /> : <Eye size={10} />}
        <span>{viewCount.toLocaleString()}</span>
      </div>

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
};
