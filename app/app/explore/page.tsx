'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Heart, MessageCircle, Loader2, Compass, Play } from 'lucide-react';
import {
  postsApi,
  realmsApi,
  signalsApi,
  REALM_CATEGORY_LABELS,
  type FeedPost,
  type Realm,
  type RealmCategory,
  type SignalListItem,
} from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';

const TRENDING_POSTS = 8;
const TOP_CREATORS = 6;
const TRENDING_REALMS = 8;

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

const PostThumb = ({ post }: { post: FeedPost }) => {
  const src = post.mediaUrls[0];

  return (
    <Link
      href="/app/for-you"
      className="glass-card glass-hover rounded-2xl overflow-hidden flex flex-col group"
    >
      <div className="relative aspect-[4/5] bg-black/40 overflow-hidden">
        {post.kind === 'image' && src ? (
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
    </Link>
  );
};

export default function ExplorePage() {
  const [category, setCategory] = useState<RealmCategory | null>(null);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [creators, setCreators] = useState<SignalListItem[]>([]);
  const [realms, setRealms] = useState<Realm[]>([]);

  const [postsLoading, setPostsLoading] = useState(true);
  const [creatorsLoading, setCreatorsLoading] = useState(true);
  const [realmsLoading, setRealmsLoading] = useState(true);

  // Posts and creators aren't categorised, so they load once. Each strip catches
  // its own failure — one dead section shouldn't blank the page.
  useEffect(() => {
    let cancelled = false;

    postsApi
      .feed(null, TRENDING_POSTS)
      .then((page) => {
        if (!cancelled) setPosts(page.items);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

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

      {/* Only realms carry a category, so a chip narrows the page to that strip. */}
      {!filtering && (
        <>
          <section className="mt-8">
            <SectionHeading title="Trending Now" href="/app/for-you" />
            {postsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : posts.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <Compass size={26} className="mx-auto text-muted-foreground" />
                <p className="mt-3 font-semibold text-card-foreground">Nothing trending yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Posts show up here as soon as people start publishing.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {posts.map((post) => (
                  <PostThumb key={post.id} post={post} />
                ))}
              </div>
            )}
          </section>

          <section className="mt-10">
            <SectionHeading title="Top Creators" href="/app/creators" />
            {creatorsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
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
          <div className="flex justify-center py-10">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
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
                    {REALM_CATEGORY_LABELS[realm.category]} ·{' '}
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
    </div>
  );
}
