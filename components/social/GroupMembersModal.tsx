'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle, ShieldCheck, X } from 'lucide-react';
import { usersApi, type FollowPerson } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { MAX_GROUP_ADMINS, type InterestGroup, useGroupActions } from '@/hooks/useGroups';

export function GroupMembersModal({
  group,
  onClose,
}: {
  group: InterestGroup;
  onClose: () => void;
}) {
  const memberIds = group.memberIds;
  const { user } = useAuth();
  const { setGroupAdmin } = useGroupActions();
  const { addToast } = useToast();
  const [members, setMembers] = useState<FollowPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminPending, setAdminPending] = useState<string | null>(null);
  const canAssignAdmins = user?.id === group.ownerId;

  const toggleAdmin = async (memberId: string) => {
    const isAdmin = group.adminIds.includes(memberId);
    const isPending = group.pendingAdminIds.includes(memberId);
    const makeAdmin = !isAdmin && !isPending;
    setAdminPending(memberId);
    try {
      await setGroupAdmin(group, memberId, makeAdmin);
      addToast({
        message: makeAdmin ? 'Admin invitation sent.' : isPending ? 'Admin invitation cancelled.' : 'Sub-admin removed.',
        type: 'success',
        duration: 3000,
      });
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not update this admin.', type: 'error', duration: 4000 });
    } finally {
      setAdminPending(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    usersApi.byIds(memberIds)
      .then((response) => {
        if (!cancelled) {
          const byId = new Map(response.items.map((person) => [person.id, person]));
          setMembers(memberIds.flatMap((id) => byId.get(id) ?? []));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          addToast({
            message: error instanceof Error ? error.message : 'Could not load group members.',
            type: 'error',
            duration: 4000,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [addToast, memberIds]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="group-members-title" className="glass-card rounded-xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        <header className="px-5 py-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 id="group-members-title" className="font-bold text-foreground">Group members</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{memberIds.length} {memberIds.length === 1 ? 'member' : 'members'} · {group.adminIds.length} admins · {group.pendingAdminIds.length} pending</p>
          </div>
          <button onClick={onClose} aria-label="Close members" className="w-8 h-8 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-foreground flex items-center justify-center"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div> : members.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Member profiles are not available yet.</p> : (
            <ul className="divide-y divide-white/10">
              {members.map((member) => {
                const mine = member.id === user?.id;
                const owner = member.id === group.ownerId;
                const admin = group.adminIds.includes(member.id);
                const pendingAdmin = group.pendingAdminIds.includes(member.id);
                return <li key={member.id} className="p-4 flex items-center gap-3">
                  <Link href={`/app/u/${member.username}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar src={member.avatarUrl} name={member.displayName} size="sm" />
                    <span className="min-w-0"><span className="flex items-center gap-1 font-semibold text-sm text-foreground truncate">{member.displayName}{member.creatorStatus === 'APPROVED' && <VerifiedBadge size={13} />}</span><span className="block text-xs text-muted-foreground truncate">@{member.username}{owner ? ' · Owner' : admin ? ' · Admin' : pendingAdmin ? ' · Invited as admin' : ''}</span></span>
                  </Link>
                  {canAssignAdmins && !owner && (
                    <button type="button" onClick={() => void toggleAdmin(member.id)} disabled={adminPending === member.id || (!admin && !pendingAdmin && group.adminIds.length + group.pendingAdminIds.length >= MAX_GROUP_ADMINS)} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold disabled:opacity-40 ${admin || pendingAdmin ? 'bg-primary/10 text-primary' : 'glass-chip text-foreground'}`}>
                      {adminPending === member.id ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                      {admin ? 'Remove admin' : pendingAdmin ? 'Cancel invite' : 'Invite as admin'}
                    </button>
                  )}
                  {!mine && <Link href={`/app/messages?with=${encodeURIComponent(member.username)}`} onClick={onClose} title={`Message ${member.displayName}`} className="w-9 h-9 flex-shrink-0 rounded-full brand-gradient text-white flex items-center justify-center hover:brightness-110"><MessageCircle size={16} /></Link>}
                </li>;
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
