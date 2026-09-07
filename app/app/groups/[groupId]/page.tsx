'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Lock, Send, UsersRound } from 'lucide-react';
import { useToast } from '@/lib/stores';
import { GroupMembersModal } from '@/components/social/GroupMembersModal';
import {
  SYSTEM_GROUPS,
  useGroup,
  useGroupActions,
  useGroupMessages,
} from '@/hooks/useGroups';

function timeLabel(date: Date | null) {
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Sending...';
}

export default function GroupDiscussionPage() {
  const params = useParams<{ groupId: string }>();
  const { group, loading } = useGroup(params.groupId);
  const { user, joinGroup, approveRequest, createSystemGroup } = useGroupActions();
  const { addToast } = useToast();
  const isSystemGroup = SYSTEM_GROUPS.some((entry) => entry.id === params.groupId);
  const [initializing, setInitializing] = useState(false);
  const isMember = Boolean(group && user && group.memberIds.includes(user.id));
  const isOwner = Boolean(group && user?.id === group.ownerId);
  const { messages, loading: messagesLoading, sendMessage } = useGroupMessages(params.groupId, isMember);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // System groups are created only when someone first opens one, keeping the
  // database clear of unused rooms while letting Explore link directly here.
  useEffect(() => {
    if (loading || group || !isSystemGroup || !user || initializing) return;
    setInitializing(true);
    createSystemGroup(params.groupId)
      .catch((error) => {
        addToast({
          message: error instanceof Error ? error.message : 'Could not open this group.',
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => setInitializing(false));
  }, [addToast, createSystemGroup, group, initializing, isSystemGroup, loading, params.groupId, user]);

  const join = async () => {
    if (!group) return;
    try {
      await joinGroup(group);
      addToast({ message: group.privacy === 'open' ? 'You joined the group.' : 'Request sent to the group owner.', type: 'success', duration: 3000 });
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not update membership.', type: 'error', duration: 4000 });
    }
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(draft);
      setDraft('');
    } catch {
      addToast({ message: 'Could not send your message.', type: 'error', duration: 4000 });
    } finally {
      setSending(false);
    }
  };

  if (loading || (isSystemGroup && !group && initializing)) {
    return <div className="p-8 text-sm text-muted-foreground">Opening group...</div>;
  }
  if (!group) return <div className="p-8 text-sm text-muted-foreground">This group could not be found.</div>;

  const requested = Boolean(user && group.pendingMemberIds.includes(user.id));
  return (
    <div className="h-full min-h-0 flex flex-col max-w-4xl mx-auto border-x border-white/10">
      <header className="p-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
        <Link href="/app/groups" aria-label="Back to groups" className="w-9 h-9 rounded-full glass-chip flex items-center justify-center text-foreground"><ArrowLeft size={17} /></Link>
        <span className="w-10 h-10 rounded-lg brand-gradient text-white flex items-center justify-center"><UsersRound size={20} /></span>
        <div className="min-w-0 flex-1"><h1 className="font-bold text-foreground truncate">{group.name}</h1><button onClick={() => setMembersOpen(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">{group.memberIds.length} members {group.privacy === 'private' && '· Private'}</button></div>
      </header>

      {isOwner && group.pendingMemberIds.length > 0 && (
        <div className="p-3 border-b border-white/10 bg-sidebar-accent/50">
          <p className="text-xs font-semibold text-foreground">Membership requests</p>
          <div className="mt-2 flex flex-wrap gap-2">{group.pendingMemberIds.map((memberId) => <button key={memberId} onClick={() => approveRequest(group, memberId)} className="px-3 py-1.5 rounded-lg glass-chip text-xs text-foreground hover:brightness-110">Approve member</button>)}</div>
        </div>
      )}

      {!isMember ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center"><Lock size={22} className="text-muted-foreground" /><h2 className="mt-3 font-bold text-foreground">{requested ? 'Request pending' : 'Join this conversation'}</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">{requested ? 'The group owner will let you know once your request is approved.' : group.description}</p>{!requested && <button onClick={join} className="mt-5 px-5 py-2.5 rounded-lg brand-gradient text-white text-sm font-semibold">{group.privacy === 'open' ? 'Join group' : 'Request to join'}</button>}</div>
      ) : (
        <><div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">{messagesLoading ? <p className="text-sm text-muted-foreground">Loading messages...</p> : messages.length === 0 ? <p className="h-full flex items-center justify-center text-sm text-muted-foreground">Start the conversation.</p> : messages.map((message) => { const mine = message.senderId === user?.id; return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] px-3 py-2 rounded-xl ${mine ? 'brand-gradient text-white' : 'glass-chip text-foreground'}`}><p className="text-xs font-semibold mb-1 opacity-80">{mine ? 'You' : message.senderName}</p><p className="text-sm whitespace-pre-wrap break-words">{message.text}</p><p className="mt-1 text-[10px] text-right opacity-70">{timeLabel(message.timestamp)}</p></div></div>; })}<div ref={bottomRef} /></div>
        <form onSubmit={send} className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${group.name}`} maxLength={4000} className="flex-1 min-w-0 px-3 py-2.5 rounded-lg glass-input text-sm text-foreground placeholder-muted-foreground" /><button disabled={!draft.trim() || sending} aria-label="Send" className="w-10 h-10 rounded-full brand-gradient text-white flex items-center justify-center disabled:opacity-50"><Send size={17} /></button></form></>
      )}
      {membersOpen && <GroupMembersModal memberIds={group.memberIds} onClose={() => setMembersOpen(false)} />}
    </div>
  );
}