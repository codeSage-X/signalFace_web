'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, MessageCircle, X } from 'lucide-react';
import { usersApi, type FollowPerson } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';

export function GroupMembersModal({
  memberIds,
  onClose,
}: {
  memberIds: string[];
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [members, setMembers] = useState<FollowPerson[]>([]);
  const [loading, setLoading] = useState(true);

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
            <p className="mt-0.5 text-xs text-muted-foreground">{memberIds.length} {memberIds.length === 1 ? 'member' : 'members'}</p>
          </div>
          <button onClick={onClose} aria-label="Close members" className="w-8 h-8 rounded-lg hover:bg-sidebar-accent text-muted-foreground hover:text-foreground flex items-center justify-center"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="py-12 flex justify-center"><Loader2 size={22} className="animate-spin text-muted-foreground" /></div> : members.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Member profiles are not available yet.</p> : (
            <ul className="divide-y divide-white/10">
              {members.map((member) => {
                const mine = member.id === user?.id;
                return <li key={member.id} className="p-4 flex items-center gap-3">
                  <Link href={`/app/u/${member.username}`} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar src={member.avatarUrl} name={member.displayName} size="sm" />
                    <span className="min-w-0"><span className="flex items-center gap-1 font-semibold text-sm text-foreground truncate">{member.displayName}{member.creatorStatus === 'APPROVED' && <VerifiedBadge size={13} />}</span><span className="block text-xs text-muted-foreground truncate">@{member.username}</span></span>
                  </Link>
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
