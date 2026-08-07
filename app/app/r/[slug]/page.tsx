'use client';

import { useCallback, useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useParams } from 'next/navigation';
import {
  BadgeCheck,
  ExternalLink,
  Link2,
  Loader2,
  Share2,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  REALM_CATEGORY_LABELS,
  realmsApi,
  type FeedPost,
  type Realm,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/lib/stores';
import { RealmPostGrid } from '@/components/creator/RealmPostGrid';

const PAGE_SIZE = 12;
const TABS = ['Posts', 'About'] as const;
type Tab = (typeof TABS)[number];

/** A realm as the public sees it. The owner's management view is /app/realm. */
export default function PublicRealmPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug;

  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  const [realm, setRealm] = useState<Realm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);

  const [tab, setTab] = useState<Tab>('Posts');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    realmsApi
      .getBySlug(slug)
      .then((result) => {
        if (!cancelled) setRealm(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load this realm.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setPostsLoading(true);

    realmsApi
      .posts(slug, null, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const loadMore = useCallback(async () => {
    if (!slug || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await realmsApi.posts(slug, nextCursor, PAGE_SIZE);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more posts.', type: 'error', duration: 4000 });
    } finally {
      setLoadingMore(false);
    }
  }, [slug, nextCursor, loadingMore, addToast]);

  const handleFollow = () => {
    requireAuth(async () => {
      if (!realm || realm.isMine) return;

      setFollowPending(true);
      try {
        const result = await realmsApi.toggleFollow(realm.slug);
        setRealm((prev) =>
          prev
            ? { ...prev, isFollowedByMe: result.following, followersCount: result.followersCount }
            : prev,
        );
        addToast({
          message: result.following ? `Following ${realm.name}` : `Unfollowed ${realm.name}`,
          type: result.following ? 'success' : 'info',
          duration: 2000,
        });
      } catch (err) {
        addToast({
          message: err instanceof Error ? err.message : 'Could not update follow.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setFollowPending(false);
      }
    });
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    addToast({ message: 'Realm link copied!', type: 'info', duration: 2500 });
  };

  if (loading) {
    return (
      <div className="min-h-full">
        <div className="h-40 sm:h-56 lg:h-64 w-full bg-white/[0.06] animate-pulse" />
        <div className="px-6 lg:px-10 -mt-12 space-y-4">
          <div className="w-24 h-24 rounded-2xl bg-white/[0.06] animate-pulse" />
          <div className="h-6 w-48 rounded bg-white/[0.06] animate-pulse" />
          <div className="h-4 w-32 rounded bg-white/[0.06] animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !realm) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="text-center">
          <p className="font-semibold text-foreground">Realm not found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error ?? 'This realm may have been removed.'}
          </p>
          <NextLink
            href="/app/realms"
            className="inline-block mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white brand-gradient hover:brightness-110 transition"
          >
            Browse realms
          </NextLink>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-12">
      {/* Cover */}
      <div className="relative h-40 sm:h-56 lg:h-64 w-full overflow-hidden bg-gradient-to-br from-violet-900 via-fuchsia-900 to-rose-900">
        {realm.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={realm.coverUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
      </div>

      <div className="px-6 lg:px-10">
        {/* Identity */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14 relative">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl brand-gradient flex items-center justify-center text-3xl font-bold text-white overflow-hidden ring-4 ring-background flex-shrink-0">
            {realm.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              realm.name.charAt(0).toUpperCase()
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{realm.name}</h1>
              <BadgeCheck size={18} className="text-primary flex-shrink-0" />
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sidebar-accent text-foreground">
                {REALM_CATEGORY_LABELS[realm.category]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              @{realm.slug} · by{' '}
              <NextLink
                href={`/app/u/${realm.owner.username}`}
                className="hover:underline text-foreground"
              >
                @{realm.owner.username}
              </NextLink>
            </p>
            {realm.tagline && (
              <p className="mt-1.5 text-sm text-foreground max-w-xl">{realm.tagline}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <Users size={15} className="text-muted-foreground" />
            <span className="font-bold text-foreground">
              {realm.followersCount.toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">Followers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{realm.postsCount.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">Posts</span>
          </div>
          {realm.signal && (
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-muted-foreground" />
              <span className="font-bold text-foreground">
                ${Number(realm.signal.price).toFixed(2)}
              </span>
              <span className="text-sm text-muted-foreground">Signal price</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {realm.isMine ? (
            <NextLink
              href="/app/realm"
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white brand-gradient hover:brightness-110 transition"
            >
              Manage your realm
            </NextLink>
          ) : (
            <button
              onClick={handleFollow}
              disabled={followPending}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 ${
                realm.isFollowedByMe
                  ? 'glass-chip text-foreground hover:brightness-110'
                  : 'brand-gradient text-white hover:brightness-110'
              }`}
            >
              {followPending && <Loader2 size={13} className="animate-spin" />}
              {realm.isFollowedByMe ? 'Following' : 'Follow realm'}
            </button>
          )}

          {realm.signal && (
            <NextLink
              href="/app/market"
              className="px-4 py-2 rounded-xl text-sm font-medium glass-chip text-foreground hover:brightness-110 transition"
            >
              Trade Signal
            </NextLink>
          )}

          <button
            onClick={handleShare}
            aria-label="Copy realm link"
            className="w-9 h-9 flex items-center justify-center rounded-xl glass-chip hover:brightness-110 transition"
          >
            <Share2 size={14} className="text-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === 'Posts' ? (
            <RealmPostGrid
              posts={posts}
              loading={postsLoading}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              emptyTitle="No posts yet"
              emptyBody={`${realm.name} hasn't published anything to this realm yet.`}
            />
          ) : (
            <div className="max-w-xl space-y-4 py-2">
              <Row label="Category" value={REALM_CATEGORY_LABELS[realm.category]} />
              <Row label="Handle" value={`@${realm.slug}`} />
              <Row
                label="Created"
                value={new Date(realm.createdAt).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              />

              {realm.websiteUrl && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Website</p>
                  <a
                    href={realm.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Link2 size={13} />
                    {realm.websiteUrl.replace(/^https?:\/\//, '')}
                    <ExternalLink size={11} />
                  </a>
                </div>
              )}

              {realm.description ? (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">About</p>
                  <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                    {realm.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-foreground">{value}</p>
  </div>
);
