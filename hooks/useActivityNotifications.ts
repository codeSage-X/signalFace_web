'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { activityApi } from '@/lib/api';
import { useAuth } from '@/lib/stores';
import { useGroups } from '@/hooks/useGroups';

const STORAGE_KEY = 'signalface.activity.lastSeenAt';
const ACTIVITY_SEEN_EVENT = 'signalface:activity-seen';
const GROUP_INVITES_SEEN_KEY = 'signalface.activity.seenGroupInvites';
const GROUP_INVITES_SEEN_EVENT = 'signalface:group-invites-seen';
const GROUP_ADMINS_SEEN_KEY = 'signalface.activity.seenGroupAdmins';
const GROUP_ADMINS_SEEN_EVENT = 'signalface:group-admins-seen';

function storedLastSeen() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function markActivitySeen(createdAt?: string | null) {
  if (typeof window === 'undefined' || !createdAt) return;
  window.localStorage.setItem(STORAGE_KEY, createdAt);
  window.dispatchEvent(new CustomEvent(ACTIVITY_SEEN_EVENT, { detail: createdAt }));
}

function groupInviteStorageKey(userId: string) {
  return `${GROUP_INVITES_SEEN_KEY}.${userId}`;
}

function storedSeenGroupInvites(userId: string) {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const stored = JSON.parse(window.localStorage.getItem(groupInviteStorageKey(userId)) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

export function markGroupInvitationsSeen(userId: string, groupIds: string[]) {
  if (typeof window === 'undefined' || groupIds.length === 0) return;
  const seen = storedSeenGroupInvites(userId);
  groupIds.forEach((id) => seen.add(id));
  window.localStorage.setItem(groupInviteStorageKey(userId), JSON.stringify([...seen]));
  window.dispatchEvent(new CustomEvent(GROUP_INVITES_SEEN_EVENT, {
    detail: { userId, groupIds },
  }));
}

function groupAdminStorageKey(userId: string) {
  return `${GROUP_ADMINS_SEEN_KEY}.${userId}`;
}

function storedSeenGroupAdmins(userId: string) {
  if (typeof window === 'undefined') return new Set<string>();
  try {
    const stored = JSON.parse(window.localStorage.getItem(groupAdminStorageKey(userId)) ?? '[]');
    return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set<string>();
  }
}

export function markGroupAdminAssignmentsSeen(userId: string, groupIds: string[]) {
  if (typeof window === 'undefined' || groupIds.length === 0) return;
  const seen = storedSeenGroupAdmins(userId);
  groupIds.forEach((id) => seen.add(id));
  window.localStorage.setItem(groupAdminStorageKey(userId), JSON.stringify([...seen]));
  window.dispatchEvent(new CustomEvent(GROUP_ADMINS_SEEN_EVENT, {
    detail: { userId, groupIds },
  }));
}

export function useActivityNotifications({ enabled = true }: { enabled?: boolean } = {}) {
  const { isAuthenticated, user } = useAuth();
  const { groups } = useGroups();
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);
  const [groupInviteUnreadCount, setGroupInviteUnreadCount] = useState(0);
  const [groupAdminUnreadCount, setGroupAdminUnreadCount] = useState(0);
  const invitationIds = useMemo(
    () => user
      ? groups.filter((group) => group.invitedMemberIds.includes(user.id)).map((group) => group.id)
      : [],
    [groups, user],
  );
  const invitationKey = invitationIds.join('|');
  const groupAdminIds = useMemo(
    () => user
      ? groups.filter((group) => group.pendingAdminIds.includes(user.id)).map((group) => group.id)
      : [],
    [groups, user],
  );
  const groupAdminKey = groupAdminIds.join('|');

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !enabled) {
      setActivityUnreadCount(0);
      return;
    }

    try {
      const res = await activityApi.list(null, 30);
      const lastSeen = storedLastSeen();
      if (!lastSeen) {
        setActivityUnreadCount(res.items.length);
        return;
      }

      const lastSeenAt = new Date(lastSeen).getTime();
      setActivityUnreadCount(
        res.items.filter((item) => new Date(item.createdAt).getTime() > lastSeenAt).length,
      );
    } catch {
      setActivityUnreadCount(0);
    }
  }, [enabled, isAuthenticated]);

  useEffect(() => {
    if (!enabled || !user) {
      setGroupInviteUnreadCount(0);
      return;
    }

    const currentIds = invitationKey ? invitationKey.split('|') : [];
    const seen = storedSeenGroupInvites(user.id);
    const current = new Set(currentIds);
    const stillRelevant = [...seen].filter((id) => current.has(id));

    // Forget invitations that are no longer pending. If the same person is
    // invited again later, it will correctly light the bell again.
    if (stillRelevant.length !== seen.size) {
      window.localStorage.setItem(groupInviteStorageKey(user.id), JSON.stringify(stillRelevant));
    }
    setGroupInviteUnreadCount(currentIds.filter((id) => !seen.has(id)).length);
  }, [enabled, invitationKey, user]);

  useEffect(() => {
    if (!enabled || !user) {
      setGroupAdminUnreadCount(0);
      return;
    }

    const currentIds = groupAdminKey ? groupAdminKey.split('|') : [];
    const seen = storedSeenGroupAdmins(user.id);
    const current = new Set(currentIds);
    const stillRelevant = [...seen].filter((id) => current.has(id));

    if (stillRelevant.length !== seen.size) {
      window.localStorage.setItem(groupAdminStorageKey(user.id), JSON.stringify(stillRelevant));
    }
    setGroupAdminUnreadCount(currentIds.filter((id) => !seen.has(id)).length);
  }, [enabled, groupAdminKey, user]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(refresh, 60_000);
    const onSeen = () => setActivityUnreadCount(0);
    const onGroupInvitesSeen = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId === user?.id) setGroupInviteUnreadCount(0);
    };
    const onGroupAdminsSeen = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (detail?.userId === user?.id) setGroupAdminUnreadCount(0);
    };
    window.addEventListener(ACTIVITY_SEEN_EVENT, onSeen);
    window.addEventListener(GROUP_INVITES_SEEN_EVENT, onGroupInvitesSeen);
    window.addEventListener(GROUP_ADMINS_SEEN_EVENT, onGroupAdminsSeen);

    return () => {
      window.clearInterval(id);
      window.removeEventListener(ACTIVITY_SEEN_EVENT, onSeen);
      window.removeEventListener(GROUP_INVITES_SEEN_EVENT, onGroupInvitesSeen);
      window.removeEventListener(GROUP_ADMINS_SEEN_EVENT, onGroupAdminsSeen);
    };
  }, [refresh, user?.id]);

  return {
    unreadCount: activityUnreadCount + groupInviteUnreadCount + groupAdminUnreadCount,
    refresh,
  };
}
