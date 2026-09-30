'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Gift,
  Heart,
  Loader2,
  MessageSquare,
  Repeat2,
  ShieldCheck,
  ShoppingBag,
  UserPlus,
  UsersRound,
} from 'lucide-react';
import { activityApi, realmsApi, type ActivityItem, type ActivityKind } from '@/lib/api';
import { useAuth, useProfileMode, useToast } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';
import {
  markActivitySeen,
  markGroupAdminAssignmentsSeen,
  markGroupInvitationsSeen,
} from '@/hooks/useActivityNotifications';
import { useGroupActions, useGroups } from '@/hooks/useGroups';

const PAGE_SIZE = 30;

const ICONS: Record<ActivityKind, typeof Bell> = {
  transaction: ShoppingBag,
  reward: Gift,
  follow: UserPlus,
  like: Heart,
  comment: MessageSquare,
  repost: Repeat2,
  admin: ShieldCheck,
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
  const { isAuthenticated, setAuthModalOpen, user } = useAuth();
  const { addToast } = useToast();
  const setRealm = useProfileMode((state) => state.setRealm);
  const { groups, loading: groupsLoading } = useGroups();
  const { acceptInvite, respondToGroupAdminInvite } = useGroupActions();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingGroupId, setAcceptingGroupId] = useState<string | null>(null);
  const [respondingAdminInviteId, setRespondingAdminInviteId] = useState<string | null>(null);
  const [respondingGroupAdminId, setRespondingGroupAdminId] = useState<string | null>(null);

  const newest = useMemo(() => items[0]?.createdAt ?? null, [items]);
  const groupInvitations = useMemo(
    () => user
      ? groups.filter((group) => (
          group.invitedMemberIds.includes(user.id)
          || group.acceptedInviteMemberIds.includes(user.id)
        ))
      : [],
    [groups, user],
  );
  const pendingGroupInvitationKey = groupInvitations
    .filter((group) => user && group.invitedMemberIds.includes(user.id))
    .map((group) => group.id)
    .join('|');
  const groupAdminAssignments = useMemo(
    () => user ? groups.filter((group) => (
      group.pendingAdminIds.includes(user.id)
      || group.acceptedAdminInviteMemberIds.includes(user.id)
      || group.rejectedAdminInviteMemberIds.includes(user.id)
      || group.adminIds.includes(user.id)
    )) : [],
    [groups, user],
  );
  const groupAdminAssignmentKey = groupAdminAssignments
    .filter((group) => user && group.pendingAdminIds.includes(user.id))
    .map((group) => group.id)
    .join('|');

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

  useEffect(() => {
    if (!user || !pendingGroupInvitationKey) return;
    markGroupInvitationsSeen(user.id, pendingGroupInvitationKey.split('|'));
  }, [pendingGroupInvitationKey, user]);

  useEffect(() => {
    if (!user || !groupAdminAssignmentKey) return;
    markGroupAdminAssignmentsSeen(user.id, groupAdminAssignmentKey.split('|'));
  }, [groupAdminAssignmentKey, user]);

  const acceptGroupInvitation = async (group: (typeof groupInvitations)[number]) => {
    setAcceptingGroupId(group.id);
    try {
      await acceptInvite(group);
      addToast({ message: `You joined ${group.name}.`, type: 'success', duration: 3000 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not accept the group invitation.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setAcceptingGroupId(null);
    }
  };

  const respondToRealmAdminInvitation = async (
    item: ActivityItem,
    response: 'accept' | 'reject',
  ) => {
    const invitation = item.adminInvitation;
    if (!invitation || invitation.status !== 'PENDING') return;
    setRespondingAdminInviteId(invitation.id);
    try {
      const result = await realmsApi.respondToAdminInvitation(invitation.id, response);
      if (result.status === 'ACCEPTED') {
        void realmsApi.getMine().then(setRealm).catch(() => {});
      }
      setItems((current) => current.map((entry) => (
        entry.id === item.id && entry.adminInvitation
          ? {
              ...entry,
              body: result.status === 'ACCEPTED'
                ? `You accepted this invitation to manage ${result.realmName}.`
                : `You rejected this invitation to manage ${result.realmName}.`,
              adminInvitation: { ...entry.adminInvitation, status: result.status },
            }
          : entry
      )));
      addToast({
        message: result.status === 'ACCEPTED'
          ? `You are now an admin of ${result.realmName}.`
          : `Admin invitation from ${result.realmName} rejected.`,
        type: 'success',
        duration: 3000,
      });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not respond to the admin invitation.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setRespondingAdminInviteId(null);
    }
  };

  const respondToGroupAdminInvitation = async (
    group: (typeof groupAdminAssignments)[number],
    response: 'accept' | 'reject',
  ) => {
    setRespondingGroupAdminId(group.id);
    try {
      await respondToGroupAdminInvite(group, response);
      addToast({
        message: response === 'accept'
          ? `You are now an admin of ${group.name}.`
          : `Admin invitation from ${group.name} rejected.`,
        type: 'success',
        duration: 3000,
      });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not respond to the group admin invitation.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setRespondingGroupAdminId(null);
    }
  };

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
          Invitations, admin assignments, follows, rewards, wallet movement, and post engagement.
        </p>
      </div>

      {(groupInvitations.length > 0 || groupAdminAssignments.length > 0) && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <ul className="divide-y divide-white/10">
            {groupInvitations.map((group) => (
              <li key={`group-invite:${group.id}`} className="flex items-center gap-3 p-4">
                <span className="w-11 h-11 flex-shrink-0 overflow-hidden rounded-full brand-gradient text-white flex items-center justify-center">
                  {group.avatarUrl ? (
                    <img src={group.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UsersRound size={20} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    Invitation to join {group.name}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {user && group.invitedMemberIds.includes(user.id)
                      ? 'You were invited to join this group.'
                      : 'You accepted this group invitation.'}
                  </span>
                </span>
                {user && group.invitedMemberIds.includes(user.id) ? (
                  <button
                    type="button"
                    onClick={() => void acceptGroupInvitation(group)}
                    disabled={acceptingGroupId === group.id}
                    className="inline-flex min-w-20 items-center justify-center rounded-xl px-4 py-2 brand-gradient text-white text-sm font-semibold disabled:opacity-60"
                  >
                    {acceptingGroupId === group.id ? <Loader2 size={16} className="animate-spin" /> : 'Accept'}
                  </button>
                ) : (
                  <span className="rounded-full bg-up/10 px-3 py-1.5 text-xs font-semibold text-up">
                    Accepted
                  </span>
                )}
              </li>
            ))}
            {groupAdminAssignments.map((group) => (
              <li key={`group-admin:${group.id}`} className="flex items-center gap-3 p-4">
                <span className="w-11 h-11 flex-shrink-0 overflow-hidden rounded-full brand-gradient text-white flex items-center justify-center">
                  {group.avatarUrl ? (
                    <img src={group.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ShieldCheck size={20} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    You were invited to be an admin of {group.name}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {user && group.pendingAdminIds.includes(user.id)
                      ? 'Accept or reject this group admin invitation.'
                      : user && group.rejectedAdminInviteMemberIds.includes(user.id)
                        ? 'You rejected this group admin invitation.'
                        : 'You accepted this group admin invitation.'}
                  </span>
                </span>
                {user && group.pendingAdminIds.includes(user.id) ? (
                  <span className="flex flex-shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => void respondToGroupAdminInvitation(group, 'reject')}
                      disabled={respondingGroupAdminId === group.id}
                      className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => void respondToGroupAdminInvitation(group, 'accept')}
                      disabled={respondingGroupAdminId === group.id}
                      className="inline-flex min-w-16 items-center justify-center rounded-lg brand-gradient px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {respondingGroupAdminId === group.id
                        ? <Loader2 size={14} className="animate-spin" />
                        : 'Accept'}
                    </button>
                  </span>
                ) : (
                  <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    user && group.rejectedAdminInviteMemberIds.includes(user.id)
                      ? 'bg-destructive/10 text-destructive'
                      : 'bg-up/10 text-up'
                  }`}>
                    {user && group.rejectedAdminInviteMemberIds.includes(user.id)
                      ? 'Rejected'
                      : 'Accepted'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading || groupsLoading ? (
        <div role="status" className="flex min-h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 size={30} className="animate-spin text-primary" />
          <p className="text-sm font-medium">Loading activity...</p>
        </div>
      ) : (
      <div className="glass-card rounded-2xl overflow-hidden">
        {error ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-foreground">Activity is unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        ) : items.length === 0 && groupInvitations.length === 0 && groupAdminAssignments.length === 0 ? (
          <div className="p-10 text-center">
            <Bell size={24} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold text-foreground">No activity yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Invitations, admin assignments, followers, rewards, wallet events, and post engagement will appear here.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="p-5 text-center text-xs text-muted-foreground">
            You have no other activity yet.
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

                  {item.adminInvitation?.status === 'PENDING' ? (
                    <span className="flex flex-shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => void respondToRealmAdminInvitation(item, 'reject')}
                        disabled={respondingAdminInviteId === item.adminInvitation?.id}
                        className="rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => void respondToRealmAdminInvitation(item, 'accept')}
                        disabled={respondingAdminInviteId === item.adminInvitation?.id}
                        className="inline-flex min-w-16 items-center justify-center rounded-lg brand-gradient px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {respondingAdminInviteId === item.adminInvitation.id
                          ? <Loader2 size={14} className="animate-spin" />
                          : 'Accept'}
                      </button>
                    </span>
                  ) : item.adminInvitation ? (
                    <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      item.adminInvitation.status === 'ACCEPTED'
                        ? 'bg-up/10 text-up'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {item.adminInvitation.status === 'ACCEPTED' ? 'Accepted' : 'Rejected'}
                    </span>
                  ) : null}
                </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      )}

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
