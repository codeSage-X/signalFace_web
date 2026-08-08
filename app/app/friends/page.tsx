'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, UserPlus, UserCheck, Users } from 'lucide-react';
import { useAuth, useToast } from '@/lib/stores';
import { usersApi, type FollowPerson } from '@/lib/api';
import { UserAvatar } from '@/components/UserAvatar';

type Tab = 'following' | 'followers';

const TABS: { key: Tab; label: string }[] = [
  { key: 'following', label: 'Following' },
  { key: 'followers', label: 'Followers' },
];

export default function FriendsPage() {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<Tab>('following');
  const [lists, setLists] = useState<Record<Tab, FollowPerson[]>>({
    following: [],
    followers: [],
  });
  const [cursors, setCursors] = useState<Record<Tab, string | null>>({
    following: null,
    followers: null,
  });
  // Tracked per tab so switching tabs doesn't show the other one's spinner.
  const [loaded, setLoaded] = useState<Record<Tab, boolean>>({
    following: false,
    followers: false,
  });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (which: Tab, cursor?: string | null) => {
      setLoading(true);
      try {
        const res =
          which === 'following'
            ? await usersApi.following(cursor)
            : await usersApi.followers(cursor);

        setLists((prev) => ({
          ...prev,
          [which]: cursor ? [...prev[which], ...res.items] : res.items,
        }));
        setCursors((prev) => ({ ...prev, [which]: res.nextCursor }));
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

  // Each tab loads once, the first time it's opened.
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
    // Optimistic across both lists — the same account can appear in each.
    const flip = (list: FollowPerson[]) =>
      list.map((p) =>
        p.id === person.id ? { ...p, isFollowedByMe: !person.isFollowedByMe } : p,
      );
    setLists((prev) => ({ following: flip(prev.following), followers: flip(prev.followers) }));

    try {
      await usersApi.toggleFollow(person.username);
    } catch (err) {
      // Put it back the way it was rather than leaving a lie on screen.
      const revert = (list: FollowPerson[]) =>
        list.map((p) =>
          p.id === person.id ? { ...p, isFollowedByMe: person.isFollowedByMe } : p,
        );
      setLists((prev) => ({
        following: revert(prev.following),
        followers: revert(prev.followers),
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

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Friends &amp; Following</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        The people you follow, and the people following you.
      </p>

      <div className="flex gap-2 sm:gap-4 mt-6 mb-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 sm:px-4 py-3 text-sm font-medium transition ${
              tab === t.key
                ? 'text-primary border-b-2 border-primary -mb-px'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
            {loaded[t.key] && ` (${lists[t.key].length})`}
          </button>
        ))}
      </div>

      {!isAuthenticated ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Users size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">Sign in to see your people</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your following and followers live on your account.
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
            {tab === 'following' ? 'You are not following anyone yet' : 'No followers yet'}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {tab === 'following'
              ? 'Follow creators from the feed and they will show up here.'
              : 'Post something and people who like it will start following you.'}
          </p>
          <Link
            href={tab === 'following' ? '/app/creators' : '/app/upload'}
            className="inline-block mt-5 px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition"
          >
            {tab === 'following' ? 'Browse creators' : 'Upload a post'}
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {people.map((person) => (
              <div
                key={person.id}
                className="glass-card glass-hover rounded-2xl p-3 sm:p-4 flex items-center gap-3 sm:gap-4"
              >
                <Link href={`/app/u/${person.username}`} className="flex-shrink-0">
                  <UserAvatar src={person.avatarUrl} name={person.displayName} size="md" />
                </Link>

                <Link href={`/app/u/${person.username}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-card-foreground truncate flex items-center gap-1.5">
                    <span className="truncate">{person.displayName}</span>
                    {person.creatorStatus === 'APPROVED' && (
                      <span className="w-4 h-4 brand-gradient rounded-full flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">
                        ✓
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">@{person.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {person.followersCount.toLocaleString()}{' '}
                    {person.followersCount === 1 ? 'follower' : 'followers'}
                  </p>
                </Link>

                <button
                  onClick={() => handleToggleFollow(person)}
                  disabled={pending === person.username}
                  className={`flex-shrink-0 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition
                    flex items-center gap-2 disabled:opacity-60 ${
                      person.isFollowedByMe
                        ? 'bg-primary/15 text-primary hover:bg-primary/25'
                        : 'brand-gradient text-white hover:brightness-110'
                    }`}
                >
                  {pending === person.username ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : person.isFollowedByMe ? (
                    <UserCheck size={15} />
                  ) : (
                    <UserPlus size={15} />
                  )}
                  <span className="hidden sm:inline">
                    {person.isFollowedByMe ? 'Following' : 'Follow'}
                  </span>
                </button>
              </div>
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
