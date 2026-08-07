'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { BadgeCheck, Loader2, Plus, Search, Sparkles, Users } from 'lucide-react';
import {
  REALM_CATEGORIES,
  REALM_CATEGORY_LABELS,
  realmsApi,
  type Realm,
  type RealmCategory,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useProfileMode, useToast } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';

const PAGE_SIZE = 12;
const SEARCH_DEBOUNCE_MS = 300;

export default function RealmsPage() {
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
        setError(err instanceof Error ? err.message : 'Could not load realms.');
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
      addToast({ message: 'Could not load more realms.', type: 'error', duration: 4000 });
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
          <h1 className="text-3xl font-bold text-foreground">Realms</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Creator pages you can follow. Every realm has its own Signal — back the ones you
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
          placeholder="Search realms by name or handle..."
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
          <p className="font-semibold text-foreground">Could not load realms</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      ) : realms.length === 0 ? (
        <div className="py-20 text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
            <Sparkles size={24} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">
            {query || category ? 'No realms match that search' : 'No realms yet'}
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
              {loadingMore ? 'Loading…' : 'Load more realms'}
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
  <div className="glass-card glass-hover rounded-2xl overflow-hidden">
    {/* Cover */}
    <NextLink
      href={`/app/r/${realm.slug}`}
      className="block relative h-24 overflow-hidden bg-gradient-to-br from-violet-800 via-fuchsia-800 to-rose-900"
    >
      {realm.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={realm.coverUrl} alt="" className="w-full h-full object-cover" />
      )}
    </NextLink>

    <div className="p-4 -mt-8 relative">
      <NextLink href={`/app/r/${realm.slug}`} className="block">
        <div className="w-14 h-14 rounded-xl brand-gradient flex items-center justify-center text-xl font-bold text-white overflow-hidden ring-4 ring-background">
          {realm.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            realm.name.charAt(0).toUpperCase()
          )}
        </div>
      </NextLink>

      <div className="mt-3">
        <NextLink href={`/app/r/${realm.slug}`} className="flex items-center gap-1.5 min-w-0">
          <h3 className="font-bold text-foreground truncate hover:underline">{realm.name}</h3>
          <BadgeCheck size={14} className="text-primary flex-shrink-0" />
        </NextLink>
        <p className="text-xs text-muted-foreground">@{realm.slug}</p>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sidebar-accent text-foreground">
          {REALM_CATEGORY_LABELS[realm.category]}
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users size={12} />
          {realm.followersCount.toLocaleString()}
        </span>
      </div>

      {realm.tagline && (
        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{realm.tagline}</p>
      )}

      {realm.isMine ? (
        <NextLink
          href="/app/realm"
          className="mt-4 block w-full text-center py-2 rounded-lg text-sm font-semibold glass-chip text-foreground hover:brightness-110 transition"
        >
          Your realm
        </NextLink>
      ) : (
        <button
          onClick={onFollow}
          disabled={pending}
          className={`mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-60 ${
            realm.isFollowedByMe
              ? 'glass-chip text-foreground hover:brightness-110'
              : 'brand-gradient text-white hover:brightness-110'
          }`}
        >
          {pending && <Loader2 size={13} className="animate-spin" />}
          {realm.isFollowedByMe ? 'Following' : 'Follow realm'}
        </button>
      )}
    </div>
  </div>
);
