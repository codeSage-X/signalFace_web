'use client';

import { UserAvatar } from '@/components/UserAvatar';

/**
 * Top Creators - Discover creators and their realms.
 * This shows ONLY realms with Signals, not regular user accounts.
 * Only Realms are "creators" in the system - regular accounts cannot own Signals.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { BadgeCheck, Loader2, Plus, Search, Sparkles, Star, Users } from 'lucide-react';
import {
  REALM_CATEGORIES,
  REALM_CATEGORY_LABELS,
  realmCategoryLabel,
  realmsApi,
  type Realm,
  type RealmCategory,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useProfileMode, useToast } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

export default function CreatorsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<RealmCategory | null>(null);
  const [realms, setRealms] = useState<Realm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingFollow, setPendingFollow] = useState<string | null>(null);

  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();
  const setBecomeCreatorOpen = useProfileMode((s) => s.setBecomeCreatorOpen);
  const { isCreator } = useProfileSwitch();

  // Debounced, so typing doesn't fire a request per keystroke.
  const [query, setQuery] = useState('');
  const debounceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => setQuery(search), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(debounceRef.current);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    realmsApi
      .list({ q: query, category, limit: PAGE_SIZE })
      .then((page) => {
        if (cancelled) return;
        setRealms(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load creators.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, category]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await realmsApi.list({
        q: query,
        category,
        cursor: nextCursor,
        limit: PAGE_SIZE,
      });
      setRealms((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...page.items.filter((r) => !seen.has(r.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more creators.', type: 'error', duration: 4000 });
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, query, category, addToast]);

  const handleFollow = (realm: Realm) => {
    requireAuth(async () => {
      if (realm.isMine) return;

      setPendingFollow(realm.id);
      // Optimistic — the card reverts below if the server disagrees.
      const nextFollowing = !realm.isFollowedByMe;
      setRealms((prev) =>
        prev.map((r) =>
          r.id === realm.id
            ? {
                ...r,
                isFollowedByMe: nextFollowing,
                followersCount: r.followersCount + (nextFollowing ? 1 : -1),
              }
            : r,
        ),
      );

      try {
        const result = await realmsApi.toggleFollow(realm.slug);
        setRealms((prev) =>
          prev.map((r) =>
            r.id === realm.id
              ? { ...r, isFollowedByMe: result.following, followersCount: result.followersCount }
              : r,
          ),
        );
        addToast({
          message: result.following ? `Following ${realm.name}` : `Unfollowed ${realm.name}`,
          type: result.following ? 'success' : 'info',
          duration: 2000,
        });
      } catch (err) {
        setRealms((prev) => prev.map((r) => (r.id === realm.id ? realm : r)));
        addToast({
          message: err instanceof Error ? err.message : 'Could not update follow.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setPendingFollow(null);
      }
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Top Creators</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Discover creators and their realms. Every realm has its own Signal, back the ones you
            believe in early.
          </p>
        </div>

        {!isCreator && (
          <button
            onClick={() => requireAuth(() => setBecomeCreatorOpen(true))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white brand-gradient brand-glow hover:brightness-110 transition"
          >
            <Plus size={15} />
            Create your realm
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          type="text"
          placeholder="Search creators by name or handle..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 glass-input rounded-xl text-foreground placeholder-muted-foreground"
        />
      </div>

      {/* Category filter — one row above the results */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <FilterChip active={category === null} onClick={() => setCategory(null)}>
          All
        </FilterChip>
        {REALM_CATEGORIES.map((c) => (
          <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
            {REALM_CATEGORY_LABELS[c]}
          </FilterChip>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="py-20 text-center">
          <p className="font-semibold text-foreground">Could not load creators</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      ) : realms.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
            <Sparkles size={24} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">
            {query || category ? 'No creators match that search' : 'No creators yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {query || category
              ? 'Try a different name or category.'
              : 'Be the first — create a realm and mint your Signal.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {realms.map((realm) => (
              <RealmCard
                key={realm.id}
                realm={realm}
                pending={pendingFollow === realm.id}
                onFollow={() => handleFollow(realm)}
              />
            ))}
          </div>

          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 text-primary text-sm font-medium py-4 hover:underline disabled:opacity-60"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" />}
              {loadingMore ? 'Loading…' : 'Load more creators'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    aria-pressed={active}
    className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
      active ? 'brand-gradient text-white' : 'glass-chip text-muted-foreground hover:text-foreground'
    }`}
  >
    {children}
  </button>
);


const RealmCard = ({
  realm,
  pending,
  onFollow,
}: {
  realm: Realm;
  pending: boolean;
  onFollow: () => void;
}) => (
  <div className="glass-card rounded-3xl overflow-hidden p-6 flex flex-col items-center text-center min-w-0">
    {/* Glowing creator avatar */}
    <NextLink
      href={`/app/r/${realm.slug}`}
      className="relative flex items-center justify-center mb-5"
      aria-label={`View ${realm.name}`}
    >
      <div className="absolute inset-[-18px] rounded-full bg-fuchsia-600/20 blur-2xl" />

      <div className="relative w-32 h-32 rounded-full p-[5px] bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 shadow-[0_0_30px_rgba(236,72,153,0.4)]">
        <div className="w-full h-full rounded-full bg-background p-[5px]">
          <div className="w-full h-full rounded-full overflow-hidden">
            <UserAvatar
              src={realm.iconUrl}
              name={realm.name}
              fill
              ring={false}
            />
          </div>
        </div>
      </div>
    </NextLink>

    {/* Creator name */}
    <NextLink
      href={`/app/r/${realm.slug}`}
      className="flex items-center justify-center gap-2 max-w-full"
    >
      <h3 className="text-2xl font-bold text-foreground truncate">
        {realm.name}
      </h3>
      <BadgeCheck
        size={23}
        className="text-pink-500 fill-pink-500 flex-shrink-0"
      />
    </NextLink>

    {/* Category and followers */}
    <p className="mt-2 text-sm text-muted-foreground">
      {realmCategoryLabel(realm)} ·{' '}
      {realm.followersCount.toLocaleString()}{' '}
      {realm.followersCount === 1 ? 'Follower' : 'Followers'}
    </p>

    {/* Signal value: connect these to your actual Signal data */}
    <div className="mt-6 mb-7">
      <p className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
        $0.00
      </p>
      <p className="mt-1 text-sm font-semibold text-emerald-400">
        +0.0% <span className="text-muted-foreground">(24h)</span>
      </p>
    </div>

    {/* Follow, Buy Signal and Watchlist */}
    <div className="w-full mt-auto grid grid-cols-[1fr_1fr_52px] gap-2 items-stretch">
      {!realm.isMine ? (
        <button
          onClick={onFollow}
          disabled={pending}
          className={`min-w-0 rounded-xl px-2 py-3 text-sm font-semibold transition disabled:opacity-60 ${
            realm.isFollowedByMe
              ? 'glass-chip text-foreground hover:brightness-110'
              : 'brand-gradient text-white hover:brightness-110'
          }`}
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin mx-auto" />
          ) : realm.isFollowedByMe ? (
            'Following'
          ) : (
            'Follow'
          )}
        </button>
      ) : (
        <NextLink
          href="/app/realm"
          className="rounded-xl px-2 py-3 text-sm font-semibold glass-chip text-foreground flex items-center justify-center"
        >
          Your realm
        </NextLink>
      )}

      <NextLink
        href={`/app/r/${realm.slug}`}
        className="rounded-xl px-2 py-3 text-sm font-semibold text-white brand-gradient hover:brightness-110 transition flex items-center justify-center"
      >
        Buy Signal
      </NextLink>

      <button
        type="button"
        aria-label={`Add ${realm.name} to watchlist`}
        title="Add to watchlist"
        className="rounded-xl border border-pink-500/60 text-pink-500 hover:bg-pink-500/10 transition flex items-center justify-center"
      >
        <Star size={20} />
      </button>
    </div>
  </div>
);

