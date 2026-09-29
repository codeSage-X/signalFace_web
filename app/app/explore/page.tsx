'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Heart,
  MessageCircle,
  Play,
} from 'lucide-react';
import {
  postsApi,
  REALM_CATEGORY_LABELS,
  type FeedPost,
  type RealmCategory,
} from '@/lib/api';
import { PostDetailModal } from '@/components/social/PostDetailModal';
import { ModeratedMedia } from '@/components/social/ModeratedMedia';
import { GroupsHub } from '@/app/app/groups/page';

const TRENDING_POSTS = 8;

// The real `RealmCategory` enum, not a hand-written list — a chip that can't be
// sent to the API as `?category=` is a chip that returns nothing.
const CATEGORIES = Object.keys(REALM_CATEGORY_LABELS) as RealmCategory[];

const fmt = (n: number) =>
  n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);

const SectionHeading = ({ title, href }: { title: string; href: string }) => (
  <Link href={href} className="group inline-flex items-center gap-2 mb-4">
    <h2 className="text-lg sm:text-xl font-bold text-foreground">{title}</h2>
    <ArrowRight
      size={18}
      className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition"
    />
  </Link>
);

const PostThumb = ({ post, onOpen }: { post: FeedPost; onOpen: () => void }) => {
  const src = post.mediaUrls[0];

  return (
    // A button, not a link: opening a post keeps the viewer on Explore rather
    // than sending them to the public feed, which used to lose their place.
    <button
      type="button"
      onClick={onOpen}
      className="glass-card glass-hover rounded-2xl overflow-hidden flex flex-col group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative aspect-[4/5] bg-black/40 overflow-hidden">
        {post.moderation === 'CENSORED' || post.moderation === 'REMOVED' ? (
          <ModeratedMedia />
        ) : post.kind === 'image' && src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-300"
          />
        ) : post.kind === 'video' && src ? (
          <>
            {/* `preload="metadata"` is enough for the first frame, without pulling
                the whole file for a grid of thumbnails. */}
            <video
              src={src}
              muted
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
                <Play size={16} className="text-white ml-0.5" fill="white" />
              </span>
            </span>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/10">
            <p className="text-sm text-white/80 line-clamp-5 text-center">
              {post.body ?? 'Post'}
            </p>
          </div>
        )}
      </div>

      <div className="p-3">
        <p className="text-sm font-semibold text-card-foreground truncate">
          {post.realm ? post.realm.name : `@${post.author.username}`}
        </p>
        {post.body && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{post.body}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Heart size={13} /> {fmt(post.likeCount)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={13} /> {fmt(post.commentCount)}
          </span>
        </div>
      </div>
    </button>
  );
};

/**
 * Placeholders shaped like the cards they stand in for, so the page keeps its
 * layout while loading instead of collapsing to a centred spinner and then
 * jumping when the real content arrives.
 */
const Shimmer = ({ className = '' }: { className?: string }) => (
  <div className={`bg-white/[0.06] animate-pulse rounded ${className}`} />
);

const PostThumbSkeleton = () => (
  <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
    <div className="aspect-[4/5] bg-white/[0.06] animate-pulse" />
    <div className="p-3 space-y-2">
      <Shimmer className="h-3.5 w-24" />
      <Shimmer className="h-3 w-full" />
      <div className="flex gap-3 pt-0.5">
        <Shimmer className="h-3 w-10" />
        <Shimmer className="h-3 w-10" />
      </div>
    </div>
  </div>
);

export default function ExplorePage() {
  const [category, setCategory] = useState<RealmCategory | null>(null);
  // Which post in the grid is open, by position. Explore stays mounted
  // underneath, so closing returns the viewer to exactly the scroll position and
  // filter they left — and the modal can walk this list.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);

  const [postsLoading, setPostsLoading] = useState(true);

  // Posts follow the selected category. With no category it falls back to the
  // ranked feed.
  useEffect(() => {
    let cancelled = false;
    setPostsLoading(true);

    // The open post belongs to the old list; a new filter invalidates its
    // position, so close rather than silently showing a different post.
    setOpenIndex(null);

    const request = category
      ? postsApi.search('', { category, limit: TRENDING_POSTS })
      : postsApi.feed(null, TRENDING_POSTS);

    request
      .then((page) => {
        if (!cancelled) setPosts(page.items);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  const filtering = category !== null;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Explore</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Discover trending posts and communities across Signal Face.
      </p>

      {/* Chips scroll rather than wrap, so sixteen categories don't push the page down. */}
      <div className="mt-5 -mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex gap-2 pb-1 w-max">
          <button
            onClick={() => setCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              category === null
                ? 'brand-gradient text-white brand-glow'
                : 'glass-chip text-muted-foreground hover:text-foreground'
            }`}
          >
            All
          </button>
          {CATEGORIES.map((key) => (
            <button
              key={key}
              onClick={() => setCategory(key)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                category === key
                  ? 'brand-gradient text-white brand-glow'
                  : 'glass-chip text-muted-foreground hover:text-foreground'
              }`}
            >
              {REALM_CATEGORY_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {!filtering && (
        <Suspense fallback={<div className="mt-8 h-40 glass-card animate-pulse" />}>
          <GroupsHub embedded />
        </Suspense>
      )}

      {/* Posts respond to the chip, so this strip stays visible while filtering. */}
      <section className="mt-8">
        <SectionHeading
          title={filtering ? `${REALM_CATEGORY_LABELS[category]} Posts` : 'Trending Now'}
          href="/app/for-you"
        />
        {postsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <PostThumbSkeleton key={i} />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Compass size={26} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">
              {filtering ? 'No posts in this category yet' : 'Nothing trending yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtering
                ? 'Try another category, or clear the filter.'
                : 'Posts show up here as soon as people start publishing.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {posts.map((post, i) => (
              <PostThumb
                key={post.id}
                post={post}
                onOpen={() => setOpenIndex(i)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Opened over the grid rather than routed to, so the filter and scroll
          position behind are preserved when it closes. */}
      {openIndex !== null && posts[openIndex] && (
        <PostDetailModal
          posts={posts}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onChanged={(updated) =>
            // Keep the card behind in step with likes, saves and reposts.
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
          }
        />
      )}
    </div>
  );
}
