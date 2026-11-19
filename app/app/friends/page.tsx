'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, UserPlus, UserCheck, Users, Heart } from 'lucide-react';
import { useAuth, useToast } from '@/lib/stores';
import { usersApi, type FollowPerson } from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { LifeConnectionsBanner } from '@/components/friends/LifeConnectionsBanner';
import { type LifeFilter } from '@/components/friends/lifeInterests';
import { LifeInterestsOnboarding } from '@/components/friends/LifeInterestsOnboarding';

type Tab = 'friends' | 'discover';

const TABS: { key: Tab; label: string }[] = [
  { key: 'friends', label: 'Connected' },
  { key: 'discover', label: 'Meet People' },
];

type DiscoverPage = { items: FollowPerson[]; cursor: string | null; loaded: boolean };
const EMPTY_PAGE: DiscoverPage = { items: [], cursor: null, loaded: false };

export default function FriendsPage() {
  const { isAuthenticated, setAuthModalOpen, updateUser } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<Tab>('discover');
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Connected = mutual follows.
  const [connected, setConnected] = useState<FollowPerson[]>([]);
  const [connectedLoaded, setConnectedLoaded] = useState(false);

  // Meet People, cached per filter so flipping between them is instant.
  const [filter, setFilter] = useState<LifeFilter>('ALL');
  const [discover, setDiscover] = useState<Partial<Record<LifeFilter, DiscoverPage>>>({});
  const activeFilter = useRef<LifeFilter>('ALL');

  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const showError = useCallback(
    (err: unknown, fallback: string) =>
      addToast({
        message: err instanceof Error ? err.message : fallback,
        type: 'error',
        duration: 4000,
      }),
    [addToast],
  );

  // First visit: ask for Life Connections interests once. Reads the live
  // profile, since the stored session may predate the field.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    usersApi
      .getMe()
      .then((me) => {
        if (cancelled) return;
        updateUser({
          lifeInterests: me.lifeInterests ?? [],
          lifeInterestsSetAt: me.lifeInterestsSetAt ?? null,
        });
        if (!me.lifeInterestsSetAt) setShowOnboarding(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, updateUser]);

  const fetchConnected = useCallback(async () => {
    setLoading(true);
    try {
      const collect = async (fetcher: typeof usersApi.following) => {
        const all: FollowPerson[] = [];
        let cursor: string | null = null;
        let pages = 0;
        do {
          const res = await fetcher(cursor);
          all.push(...res.items);
          cursor = res.nextCursor;
          pages++;
        } while (cursor && pages < 5); // 5 pages max
        return all;
      };
      const [following, followers] = await Promise.all([
        collect(usersApi.following),
        collect(usersApi.followers),
      ]);
      const followerIds = new Set(followers.map((f) => f.id));
      setConnected(following.filter((f) => followerIds.has(f.id)));
    } catch (err) {
      showError(err, 'Could not load your connections.');
    } finally {
      setConnectedLoaded(true);
      setLoading(false);
    }
  }, [showError]);

  const fetchDiscover = useCallback(
    async (which: LifeFilter, cursor?: string | null) => {
      setLoading(true);
      try {
        const res = await usersApi.discover(which === 'ALL' ? null : which, cursor, 24);
        setDiscover((prev) => {
          const before = cursor ? prev[which] ?? EMPTY_PAGE : EMPTY_PAGE;
          // Keyset pages never overlap, but guard anyway so a double-fire can't duplicate.
          const seen = new Set(before.items.map((p) => p.id));
          return {
            ...prev,
            [which]: {
              items: [...before.items, ...res.items.filter((p) => !seen.has(p.id))],
              cursor: res.nextCursor,
              loaded: true,
            },
          };
        });
      } catch (err) {
        showError(err, 'Could not load people.');
        setDiscover((prev) => ({ ...prev, [which]: { ...(prev[which] ?? EMPTY_PAGE), loaded: true } }));
      } finally {
        // Only clear the spinner for the filter still on screen.
        if (activeFilter.current === which) setLoading(false);
      }
    },
    [showError],
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    if (tab === 'friends' && !connectedLoaded) fetchConnected();
    if (tab === 'discover' && !discover[filter]?.loaded) fetchDiscover(filter);
  }, [isAuthenticated, tab, filter, connectedLoaded, discover, fetchConnected, fetchDiscover]);

  const changeFilter = (next: LifeFilter) => {
    activeFilter.current = next;
    setLoading(false);
    setFilter(next);
  };

  const page = discover[filter] ?? EMPTY_PAGE;
  const people = tab === 'friends' ? connected : page.items;
  const isLoaded = tab === 'friends' ? connectedLoaded : page.loaded;
  const nextCursor = tab === 'discover' ? page.cursor : null;

  // Continuous scroll: fetch the next page as the end of the list comes into view.
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !nextCursor || loading) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchDiscover(filter, nextCursor);
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nextCursor, loading, filter, fetchDiscover]);

  const handleToggleFollow = async (person: FollowPerson) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    const setFollowed = (value: boolean) => {
      const flip = (list: FollowPerson[]) =>
        list.map((p) => (p.id === person.id ? { ...p, isFollowedByMe: value } : p));
      setConnected(flip);
      setDiscover((prev) => {
        const next: typeof prev = {};
        for (const [k, v] of Object.entries(prev)) {
          if (v) next[k as LifeFilter] = { ...v, items: flip(v.items) };
        }
        return next;
      });
    };

    setPending(person.username);
    setFollowed(!person.isFollowedByMe);
    try {
      await usersApi.toggleFollow(person.username);
    } catch (err) {
      setFollowed(person.isFollowedByMe);
      showError(err, 'That did not go through.');
    } finally {
      setPending(null);
    }
  };

  const showEmpty = isLoaded && !loading && people.length === 0;
  const isGridView = tab === 'discover';

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      {showOnboarding && <LifeInterestsOnboarding onDone={() => setShowOnboarding(false)} />}

      <LifeConnectionsBanner
        active={tab === 'discover' ? filter : null}
        onSelect={(next) => {
          setTab('discover');
          changeFilter(next);
        }}
      />

      <p className="mt-6 text-sm text-muted-foreground">
        {tab === 'friends' && 'People you follow who follow you back'}
        {tab === 'discover' && 'People you haven\'t connected with yet'}
      </p>

      <div className="flex gap-2 sm:gap-4 mt-4 mb-6 border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-3 text-sm font-medium transition whitespace-nowrap ${
              tab === t.key
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {t.key === 'friends' && connectedLoaded && ` (${connected.length})`}
          </button>
        ))}
      </div>

      {!isAuthenticated ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Users size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">Sign in to see your connections</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your connections live on your account.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="mt-5 px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition"
          >
            Sign in
          </button>
        </div>
      ) : !isLoaded ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : showEmpty ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Users size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">
            {tab === 'friends' && 'No connections yet'}
            {tab === 'discover' &&
              (filter === 'ALL' ? 'No one new to meet right now' : 'No people found for this interest yet.')}
          </p>
          {tab === 'friends' && (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow people and they will show up here if they follow you back.
              </p>
              <button
                onClick={() => setTab('discover')}
                className="inline-block mt-5 px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition"
              >
                Meet people
              </button>
            </>
          )}
          {tab === 'discover' && filter !== 'ALL' && (
            <button
              onClick={() => changeFilter('ALL')}
              className="inline-block mt-5 px-5 py-2.5 rounded-xl glass-chip text-sm font-medium text-foreground hover:brightness-125 transition"
            >
              Show everybody
            </button>
          )}
        </div>
      ) : isGridView ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {people.map((person) => (
              <FriendCard
                key={person.id}
                person={person}
                onToggleFollow={handleToggleFollow}
                pending={pending === person.username}
              />
            ))}
          </div>
          <div ref={sentinel} className="flex justify-center py-6">
            {loading && nextCursor && <Loader2 size={20} className="animate-spin text-muted-foreground" />}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          {people.map((person) => (
            <FriendListItem
              key={person.id}
              person={person}
              onToggleFollow={handleToggleFollow}
              pending={pending === person.username}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// List item component for Friends, Following, Followers
function FriendListItem({
  person,
  onToggleFollow,
  pending,
}: {
  person: FollowPerson;
  onToggleFollow: (person: FollowPerson) => void;
  pending: boolean;
}) {
  return (
    <div className="glass-card glass-hover rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4">
      <Link href={`/app/u/${person.username}`} className="flex-shrink-0">
        <UserAvatar src={person.avatarUrl} name={person.displayName} size="md" />
      </Link>

      <Link href={`/app/u/${person.username}`} className="flex-1 min-w-0">
        <p className="font-semibold text-card-foreground truncate flex items-center gap-1.5">
          <span className="truncate">{person.displayName}</span>
          {person.isVerified && <VerifiedBadge size={16} />}
        </p>
        <p className="text-sm text-muted-foreground truncate">@{person.username}</p>
        <p className="text-xs text-muted-foreground">
          {person.followersCount.toLocaleString()} {person.followersCount === 1 ? 'follower' : 'followers'}
        </p>
      </Link>

      <button
        onClick={() => onToggleFollow(person)}
        disabled={pending}
        className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 disabled:opacity-60 ${
          person.isFollowedByMe
            ? 'bg-primary/15 text-primary hover:bg-primary/25'
            : 'brand-gradient text-white hover:brightness-110'
        }`}
      >
        {pending ? (
          <Loader2 size={15} className="animate-spin" />
        ) : person.isFollowedByMe ? (
          <UserCheck size={15} />
        ) : (
          <UserPlus size={15} />
        )}
        <span className="hidden sm:inline">{person.isFollowedByMe ? 'Following' : 'Follow'}</span>
      </button>
    </div>
  );
}

// Grid card component for Meet People
function FriendCard({
  person,
  onToggleFollow,
  pending,
}: {
  person: FollowPerson;
  onToggleFollow: (person: FollowPerson) => void;
  pending: boolean;
}) {
  return (
    <div className="glass-card glass-hover rounded-2xl overflow-hidden flex flex-col h-full">
      <Link href={`/app/u/${person.username}`} className="flex-shrink-0">
        <div className="relative aspect-square overflow-hidden bg-black dark:bg-white">
          <UserAvatar src={person.avatarUrl} name={person.displayName} fill ring={false} className="absolute inset-0" />
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link href={`/app/u/${person.username}`} className="block">
          <p className="font-semibold text-card-foreground truncate flex items-center gap-1 text-sm">
            <span className="truncate">{person.displayName}</span>
            {person.isVerified && <VerifiedBadge size={14} />}
          </p>
          <p className="text-xs text-muted-foreground truncate">@{person.username}</p>
        </Link>

        <div className="mt-2 mb-4 flex-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Heart size={12} />
            {person.followersCount.toLocaleString()}{' '}
            {person.followersCount === 1 ? 'follower' : 'followers'}
          </p>
        </div>

        <button
          onClick={() => onToggleFollow(person)}
          disabled={pending}
          className={`w-full py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60 ${
            person.isFollowedByMe
              ? 'bg-primary/15 text-primary hover:bg-primary/25'
              : 'brand-gradient text-white hover:brightness-110'
          }`}
        >
          {pending ? (
            <Loader2 size={13} className="animate-spin" />
          ) : person.isFollowedByMe ? (
            <>
              <UserCheck size={13} />
              Following
            </>
          ) : (
            <>
              <UserPlus size={13} />
              Follow
            </>
          )}
        </button>
      </div>
    </div>
  );
}
