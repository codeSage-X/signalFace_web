'use client';

import { useCallback, useEffect, useState } from 'react';
import { activityApi } from '@/lib/api';
import { useAuth } from '@/lib/stores';

const STORAGE_KEY = 'signalface.activity.lastSeenAt';
const ACTIVITY_SEEN_EVENT = 'signalface:activity-seen';

function storedLastSeen() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function markActivitySeen(createdAt?: string | null) {
  if (typeof window === 'undefined' || !createdAt) return;
  window.localStorage.setItem(STORAGE_KEY, createdAt);
  window.dispatchEvent(new CustomEvent(ACTIVITY_SEEN_EVENT, { detail: createdAt }));
}

export function useActivityNotifications({ enabled = true }: { enabled?: boolean } = {}) {
  const isAuthenticated = useAuth((s) => s.isAuthenticated);
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !enabled) {
      setUnreadCount(0);
      return;
    }

    try {
      const res = await activityApi.list(null, 30);
      const lastSeen = storedLastSeen();
      if (!lastSeen) {
        setUnreadCount(0);
        if (res.items[0]) markActivitySeen(res.items[0].createdAt);
        return;
      }

      const lastSeenAt = new Date(lastSeen).getTime();
      setUnreadCount(
        res.items.filter((item) => new Date(item.createdAt).getTime() > lastSeenAt).length,
      );
    } catch {
      setUnreadCount(0);
    }
  }, [enabled, isAuthenticated]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 60_000);
    const onSeen = () => setUnreadCount(0);
    window.addEventListener(ACTIVITY_SEEN_EVENT, onSeen);

    return () => {
      window.clearInterval(id);
      window.removeEventListener(ACTIVITY_SEEN_EVENT, onSeen);
    };
  }, [refresh]);

  return { unreadCount, refresh };
}
