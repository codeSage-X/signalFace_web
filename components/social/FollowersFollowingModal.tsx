'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, UserPlus, UserCheck } from 'lucide-react';
import Link from 'next/link';
import { usersApi, type FollowPerson } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';

type ListType = 'followers' | 'following';

interface FollowersFollowingModalProps {
  username: string;
  initialTab?: ListType;
  onClose: () => void;
}

export function FollowersFollowingModal({
  username,
  initialTab = 'followers',
  onClose,
}: FollowersFollowingModalProps) {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<ListType>(initialTab);
  const [lists, setLists] = useState<Record<ListType, FollowPerson[]>>({
    followers: [],
    following: [],
  });
  const [loaded, setLoaded] = useState<Record<ListType, boolean>>({
    followers: false,
    following: false,
  });
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  const fetchList = useCallback(
    async (which: ListType) => {
      setLoading(true);
      try {
        let allItems: FollowPerson[] = [];
        let cursor: string | null = null;
        let pageCount = 0;

        if (which === 'followers') {
          do {
            const res = await usersApi.userFollowers(username, cursor);
            allItems.push(...res.items);
            cursor = res.nextCursor;
            pageCount++;
          } while (cursor && pageCount < 10);
        } else {
          do {
            const res = await usersApi.userFollowing(username, cursor);
            allItems.push(...res.items);
            cursor = res.nextCursor;
            pageCount++;
          } while (cursor && pageCount < 10);
        }

        setLists((prev) => ({ ...prev, [which]: allItems }));
        setLoaded((prev) => ({ ...prev, [which]: true }));
      } catch (err) {
        addToast({
          message: err instanceof Error ? err.message : 'Could not load that list.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setLoading(false);
      }
    },
    [username, addToast],
  );

  useEffect(() => {
    if (loaded[tab]) return;
    fetchList(tab);
  }, [tab, loaded, fetchList]);

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
      followers: flip(prev.followers),
      following: flip(prev.following),
    }));

    try {
      await usersApi.toggleFollow(person.username);
    } catch (err) {
      const revert = (list: FollowPerson[]) =>
        list.map((p) =>
          p.id === person.id ? { ...p, isFollowedByMe: person.isFollowedByMe } : p,
        );
      setLists((prev) => ({
        followers: revert(prev.followers),
        following: revert(prev.following),
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

  const items = lists[tab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="glass-card rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
          <h2 className="text-lg font-bold text-foreground">
            {tab === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/[0.08] rounded-lg transition"
            aria-label="Close"
          >
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/[0.08]">
          {(['followers', 'following'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition ${
                tab === t
                  ? 'text-foreground border-b-2 border-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t === 'followers' ? 'Followers' : 'Following'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && !loaded[tab] ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-muted-foreground text-sm">
                {tab === 'followers'
                  ? 'No followers yet'
                  : `${username} is not following anyone yet`}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.08]">
              {items.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between gap-3 px-6 py-4 hover:bg-white/[0.04] transition"
                >
                  <Link
                    href={`/app/u/${person.username}`}
                    onClick={onClose}
                    className="flex-1 flex items-center gap-3 min-w-0"
                  >
                    <UserAvatar
                      src={person.avatarUrl}
                      name={person.displayName}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="font-semibold text-foreground truncate">
                          {person.displayName}
                        </p>
                        {person.creatorStatus === 'APPROVED' && (
                          <VerifiedBadge size={14} />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        @{person.username}
                      </p>
                    </div>
                  </Link>

                  {person.username !== username && (
                    <button
                      onClick={() => handleToggleFollow(person)}
                      disabled={pending === person.username}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-lg font-semibold text-sm transition disabled:opacity-70 ${
                        person.isFollowedByMe
                          ? 'glass-chip text-foreground hover:brightness-125'
                          : 'text-white brand-gradient brand-glow hover:brightness-110'
                      }`}
                    >
                      {pending === person.username ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : person.isFollowedByMe ? (
                        <UserCheck size={14} />
                      ) : (
                        <UserPlus size={14} />
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
