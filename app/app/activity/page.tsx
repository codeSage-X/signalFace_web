'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Gift,
  Heart,
  Loader2,
  MessageSquare,
  Repeat2,
  ShoppingBag,
  UserPlus,
} from 'lucide-react';
import { activityApi, type ActivityItem, type ActivityKind } from '@/lib/api';
import { useAuth } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';
import { markActivitySeen } from '@/hooks/useActivityNotifications';

const PAGE_SIZE = 30;

const ICONS: Record<ActivityKind, typeof Bell> = {
  transaction: ShoppingBag,
  reward: Gift,
  follow: UserPlus,
  like: Heart,
  comment: MessageSquare,
  repost: Repeat2,
};

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function iconTone(item: ActivityItem) {
  if (item.tone === 'up') return 'text-up';
  if (item.tone === 'down') return 'text-destructive';
  if (item.kind === 'like') return 'text-primary';
  if (item.kind === 'comment') return 'text-sky-300';
  if (item.kind === 'follow') return 'text-up';
  return 'text-muted-foreground';
}

export default function ActivityPage() {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newest = useMemo(() => items[0]?.createdAt ?? null, [items]);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setCursor(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    activityApi
      .list(null, PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setCursor(res.nextCursor);
        if (res.items[0]) markActivitySeen(res.items[0].createdAt);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load activity.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (newest) markActivitySeen(newest);
  }, [newest]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await activityApi.list(cursor, PAGE_SIZE);
      setItems((prev) => [...prev, ...res.items]);
      setCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load more activity.');
    } finally {
      setLoadingMore(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
          <Bell size={24} className="text-muted-foreground" />
        </div>
        <p className="text-foreground font-semibold text-lg">Sign in to see notifications</p>
        <p className="text-muted-foreground text-sm mt-1 mb-5">
          Follows, rewards, wallet activity, and post engagement collect here.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm brand-gradient hover:brightness-110 transition"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Activity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Notifications for follows, rewards, wallet movement, and engagement on your posts.
        </p>
      </div>

      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-white/[0.06] animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-52 max-w-full rounded bg-white/[0.06] animate-pulse" />
                  <div className="h-3 w-28 rounded bg-white/[0.06] animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Activity is unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <Bell size={24} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              New followers, rewards, wallet events, likes, comments, and reposts will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {items.map((item) => {
              const Icon = ICONS[item.kind];
              return (
                <li key={item.id}>
                <div className="flex items-start gap-3 p-4 text-left hover:bg-white/[0.03] transition">
                  <span className="relative flex-shrink-0">
                    {item.actor ? (
                      <UserAvatar src={item.actor.avatarUrl} name={item.actor.displayName} size="sm" />
                    ) : (
                      <span className="w-9 h-9 rounded-full bg-sidebar-accent flex items-center justify-center">
                        <Icon size={16} className={iconTone(item)} />
                      </span>
                    )}
                    {item.actor && (
                      <span className="absolute -right-1 -bottom-1 w-5 h-5 rounded-full bg-background ring-2 ring-background flex items-center justify-center">
                        <Icon size={12} className={iconTone(item)} />
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                    {item.body && (
                      <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.body}
                      </span>
                    )}
                    <span className="block text-xs text-muted-foreground mt-1">
                      {timeAgo(item.createdAt)}
                    </span>
                  </span>

                  {item.amount && (
                    <span
                      className={`text-sm font-bold flex-shrink-0 ${
                        item.tone === 'down' ? 'text-down' : 'text-up'
                      }`}
                    >
                      {item.amount}
                    </span>
                  )}
                </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {cursor && !loading && !error && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl glass-chip text-sm font-semibold text-foreground hover:bg-white/[0.06] disabled:opacity-60 transition"
          >
            {loadingMore && <Loader2 size={16} className="animate-spin" />}
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
