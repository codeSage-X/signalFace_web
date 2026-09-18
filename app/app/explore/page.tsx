'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Heart,
  HeartHandshake,
  HeartPulse,
  MessageCircle,
  Play,
  UsersRound,
} from 'lucide-react';
import {
  postsApi,
  realmsApi,
  signalsApi,
  REALM_CATEGORY_LABELS,
  realmCategoryLabel,
  type FeedPost,
  type Realm,
  type RealmCategory,
  type SignalListItem,
} from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';
import { PostDetailModal } from '@/components/social/PostDetailModal';
import { ModeratedMedia } from '@/components/social/ModeratedMedia';

const TRENDING_POSTS = 8;
const TOP_CREATORS = 6;
const TRENDING_REALMS = 8;

// Curated by Signal Face, these hubs are open group conversations.
const INTEREST_GROUPS = [
  {
    name: 'Single Forum',
    description: 'Meet people, swap dating stories, and talk through modern romance.',
    id: 'single-forum',
    icon: UsersRound,
    tone: 'from-violet-600 to-indigo-700',
  },
  {
    name: 'Marriage Advice',
    description: 'Thoughtful conversations about partnership, trust, and communication.',
    id: 'marriage-advice',
    icon: HeartHandshake,
    tone: 'from-rose-600 to-pink-700',
  },
  {
    name: 'Health Solutions',
    description: 'Share routines, encouragement, and practical wellbeing ideas.',
    id: 'health-solutions',
    icon: HeartPulse,
    tone: 'from-emerald-600 to-teal-700',
  },
] as const;

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

const CreatorCardSkeleton = () => (
  <div className="glass-card rounded-2xl p-4">
    <div className="flex items-center gap-3">
      <Shimmer className="w-11 h-11 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Shimmer className="h-3.5 w-28" />
        <Shimmer className="h-3 w-20" />
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between">
      <Shimmer className="h-3 w-16" />
      <Shimmer className="h-3 w-12" />
    </div>
  </div>
);

const RealmCardSkeleton = () => (
  <div className="glass-card rounded-2xl overflow-hidden flex flex-col">
    <div className="h-24 bg-white/[0.06] animate-pulse" />
    <div className="p-4 space-y-2">
      <Shimmer className="h-3.5 w-32" />
      <Shimmer className="h-3 w-20" />
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
  const [creators, setCreators] = useState<SignalListItem[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);

  const [postsLoading, setPostsLoading] = useState(true);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const [realmsLoading, setRealmsLoading] = useState(true);

  // Posts follow the chip now that they carry a topic of their own: picking a
  // category narrows the posts as well as the realms, instead of hiding the
  // strip entirely. With no chip it falls back to the ranked feed.
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

  // Creators aren't categorised, so they load once. Each strip catches its own
  // failure — one dead section shouldn't blank the page.
  useEffect(() => {
    let cancelled = false;

    signalsApi
      .list()
      .then((items) => {
        if (!cancelled) setCreators(items.slice(0, TOP_CREATORS));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCreatorsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Realms re-fetch whenever the chip changes, filtered server-side.
  useEffect(() => {
    let cancelled = false;
    setRealmsLoading(true);

    realmsApi
      .list({ category, limit: TRENDING_REALMS })
      .then((page) => {
        if (!cancelled) setRealms(page.items);
      })
      .catch(() => {
        if (!cancelled) setRealms([]);
      })
      .finally(() => {
        if (!cancelled) setRealmsLoading(false);
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
        Trending posts, creators and realms across Signal Face.
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
        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Interest Groups</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Communities curated by Signal Face.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {INTEREST_GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <Link
                  key={group.name}
                  href={`/app/groups/${group.id}`}
                  className="glass-card glass-hover rounded-xl p-4 group"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${group.tone} flex items-center justify-center text-white shadow-lg`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-bold text-card-foreground group-hover:text-primary transition">
                    {group.name}
                  </h3>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground line-clamp-2">
                    {group.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                    Open group <ArrowRight size={15} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
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

      {/* Creators carry no category, so they drop out while a chip is active. */}
      {!filtering && (
        <>
          <section className="mt-10">
            <SectionHeading title="Top Creators" href="/app/creators" />
            {creatorsLoading ? (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <CreatorCardSkeleton key={i} />
                ))}
              </div>
            ) : creators.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <p className="font-semibold text-card-foreground">No creators yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Approved creators appear here once they have a Signal.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {creators.map((s) => {
                  const g = Number(s.growthPct);
                  return (
                    <Link
                      key={s.id}
                      href={`/app/u/${s.creatorUsername}`}
                      className="glass-card glass-hover rounded-2xl p-4 flex flex-col"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <UserAvatar
                          src={s.creatorAvatarUrl}
                          name={s.creatorName}
                          size="md"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-card-foreground truncate">
                            {s.creatorName}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            @{s.creatorUsername}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
                        <span className="text-muted-foreground">
                          {fmt(s.holdersCount)} {s.holdersCount === 1 ? 'holder' : 'holders'}
                        </span>
                        <span className="font-bold text-primary">
                          ${Number(s.price).toFixed(2)}
                        </span>
                      </div>

                      <div
                        className={`mt-3 rounded-xl py-2 text-center text-sm font-semibold ${
                          g > 0
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : g < 0
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-white/[0.04] text-muted-foreground'
                        }`}
                      >
                        {g > 0 ? '+' : ''}
                        {Number.isFinite(g) ? g.toFixed(2) : '0.00'}% (24h)
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <section className="mt-10">
        <SectionHeading
          title={filtering ? `${REALM_CATEGORY_LABELS[category]} Realms` : 'Trending Realms'}
          href="/app/realms"
        />
        {realmsLoading ? (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <RealmCardSkeleton key={i} />
            ))}
          </div>
        ) : realms.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Compass size={26} className="mx-auto text-muted-foreground" />
            <p className="mt-3 font-semibold text-card-foreground">
              {filtering ? 'No realms in this category yet' : 'No realms yet'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtering
                ? 'Try another category, or clear the filter.'
                : 'Creator pages appear here once they are approved.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {realms.map((realm) => (
              <Link
                key={realm.id}
                href={`/app/r/${realm.slug}`}
                className="glass-card glass-hover rounded-2xl overflow-hidden flex flex-col"
              >
                <div className="relative h-24 bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10">
                  {realm.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={realm.coverUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  {/* Realm icon is a rounded square, never a circle — that shape is
                      reserved for people. */}
                  <span className="absolute -bottom-5 left-4 w-12 h-12 rounded-xl overflow-hidden ring-2 ring-background bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold">
                    {realm.iconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      realm.name.charAt(0).toUpperCase()
                    )}
                  </span>
                </div>

                <div className="pt-7 px-4 pb-4 flex-1 flex flex-col">
                  <p className="font-semibold text-card-foreground truncate">{realm.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {realmCategoryLabel(realm)} ·{' '}
                    {realm.followersCount.toLocaleString()}{' '}
                    {realm.followersCount === 1 ? 'follower' : 'followers'}
                  </p>
                  {realm.tagline && (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                      {realm.tagline}
                    </p>
                  )}
                  <p className="mt-auto pt-3 text-xs text-muted-foreground">
                    {realm.postsCount.toLocaleString()}{' '}
                    {realm.postsCount === 1 ? 'post' : 'posts'}
                  </p>
                </div>
              </Link>
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
