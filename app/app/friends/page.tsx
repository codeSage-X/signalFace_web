'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, UserPlus, UserCheck, Users, Heart } from 'lucide-react';
import { useAuth, useToast } from '@/lib/stores';
import { usersApi, type FollowPerson } from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';

type Tab = 'friends' | 'discover';

const TABS: { key: Tab; label: string }[] = [
  { key: 'friends', label: 'Friends' },
  { key: 'discover', label: 'Find Friends' },
];

export default function FriendsPage() {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<Tab>('friends');
  const [lists, setLists] = useState<Record<Tab, FollowPerson[]>>({
    friends: [],
    discover: [],
  });
  const [cursors, setCursors] = useState<Record<Tab, string | null>>({
    friends: null,
    discover: null,
  });
  const [loaded, setLoaded] = useState<Record<Tab, boolean>>({
    friends: false,
    discover: false,
  });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (which: Tab, cursor?: string | null) => {
      setLoading(true);
      try {
        if (which === 'discover') {
          // Get suggestions for "Find Friends"
          const res = await usersApi.suggestions(50);
          setCursors((prev) => ({ ...prev, [which]: null }));
          setLists((prev) => ({
            ...prev,
            [which]: res.items,
          }));
          setLoaded((prev) => ({ ...prev, [which]: true }));
          setLoading(false);
          return;
        } else {
          // Friends = mutual follows
          // Fetch following with pagination
          const allFollowing: FollowPerson[] = [];
          let followingCursor: string | null = null;
          let pageCount = 0;
          
          do {
            const followingRes = await usersApi.following(followingCursor);
            allFollowing.push(...followingRes.items);
            followingCursor = followingRes.nextCursor;
            pageCount++;
          } while (followingCursor && pageCount < 5); // Limit to 5 pages max
          
          // Fetch followers with pagination
          const allFollowers: FollowPerson[] = [];
          let followersCursor: string | null = null;
          pageCount = 0;
          
          do {
            const followersRes = await usersApi.followers(followersCursor);
            allFollowers.push(...followersRes.items);
            followersCursor = followersRes.nextCursor;
            pageCount++;
          } while (followersCursor && pageCount < 5); // Limit to 5 pages max
          
          // Calculate mutual friends
          const followersSet = new Set(allFollowers.map((f) => f.id));
          const mutualFriends = allFollowing.filter((f) => followersSet.has(f.id));
          
          setLists((prev) => ({
            ...prev,
            [which]: mutualFriends,
          }));
          setCursors((prev) => ({ ...prev, [which]: null }));
          setLoaded((prev) => ({ ...prev, [which]: true }));
          setLoading(false);
          return;
        }
      } catch (err) {
        addToast({
          message: err instanceof Error ? err.message : 'Could not load that list.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setLoaded((prev) => ({ ...prev, [which]: true }));
        setLoading(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    if (!isAuthenticated || loaded[tab]) return;
    fetchPage(tab);
  }, [isAuthenticated, tab, loaded, fetchPage]);

  const handleToggleFollow = async (person: FollowPerson) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    setPending(person.username);
    const flip = (list: FollowPerson[]) =>
      list.map((p) =>
        p.id === person.id ? { ...p, isFollowedByMe: !person.isFollowedByMe } : p,
      );
    setLists((prev) => ({
      ...prev,
      friends: flip(prev.friends),
      discover: flip(prev.discover),
    }));

    try {
      await usersApi.toggleFollow(person.username);
    } catch (err) {
      const revert = (list: FollowPerson[]) =>
        list.map((p) =>
          p.id === person.id ? { ...p, isFollowedByMe: person.isFollowedByMe } : p,
        );
      setLists((prev) => ({
        friends: revert(prev.friends),
        discover: revert(prev.discover),
      }));
      addToast({
        message: err instanceof Error ? err.message : 'That did not go through.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setPending(null);
    }
  };

  const people = lists[tab];
  const showEmpty = loaded[tab] && !loading && people.length === 0;
  const isGridView = tab === 'discover';

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Friends &amp; Discover</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {tab === 'friends' && 'People who are following you and you are following back'}
        {tab === 'discover' && 'Discover people you might want to follow'}
      </p>

      <div className="flex gap-2 sm:gap-4 mt-6 mb-6 border-b border-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            {loaded[t.key] && t.key !== 'discover' && ` (${lists[t.key].length})`}
          </button>
        ))}
      </div>

      {!isAuthenticated ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Users size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">Sign in to see your friends</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your friends and connections live on your account.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="mt-5 px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition"
          >
            Sign in
          </button>
        </div>
      ) : !loaded[tab] && loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : showEmpty ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Users size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">
            {tab === 'friends' && 'No friends yet'}
            {tab === 'discover' && 'No suggestions available'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === 'friends' && 'Follow people and they will show up here if they follow you back.'}
            {tab === 'discover' && 'Check back later for new suggestions.'}
          </p>
          <Link
            href="/app/creators"
            className="inline-block mt-5 px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition"
          >
            Browse creators
          </Link>
        </div>
      ) : isGridView ? (
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
      ) : (
        <>
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

          {cursors[tab] && (
            <div className="flex justify-center mt-6">
              <button
                onClick={() => fetchPage(tab, cursors[tab])}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl glass-chip text-sm font-medium text-foreground hover:brightness-125 transition disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
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
          {person.creatorStatus === 'APPROVED' && <VerifiedBadge size={16} />}
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

// Grid card component for Find Friends
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
        <div className="aspect-square overflow-hidden bg-gradient-to-br from-violet-500/25 to-fuchsia-500/10">
          {person.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.avatarUrl} alt={person.displayName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-fuchsia-500">
              <span className="text-white text-3xl font-bold">
                {person.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        <Link href={`/app/u/${person.username}`} className="block">
          <p className="font-semibold text-card-foreground truncate flex items-center gap-1 text-sm">
            <span className="truncate">{person.displayName}</span>
            {person.creatorStatus === 'APPROVED' && <VerifiedBadge size={14} />}
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
