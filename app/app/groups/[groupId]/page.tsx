'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ImagePlus, Lock, MessageCircle, UsersRound, Video } from 'lucide-react';
import { useToast } from '@/lib/stores';
import { GroupMembersModal } from '@/components/social/GroupMembersModal';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageMedia } from '@/components/chat/MessageMedia';
import { SYSTEM_GROUPS, type InterestGroup, useGroup, useGroupActions, useGroupMessages } from '@/hooks/useGroups';

function timeLabel(date: Date | null) {
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'Sending...';
}

export default function GroupDiscussionPage() {
  const params = useParams<{ groupId: string }>();
  const { group, loading } = useGroup(params.groupId);
  const { user, joinGroup, approveRequest, createSystemGroup } = useGroupActions();
  const { addToast } = useToast();
  const systemSource = SYSTEM_GROUPS.find((entry) => entry.id === params.groupId);
  const displayGroup: InterestGroup | null = group ?? (systemSource ? {
    ...systemSource,
    privacy: 'open',
    systemCreated: true,
    ownerId: null,
    memberIds: [],
    pendingMemberIds: [],
    createdAt: null,
  } : null);
  const isMember = Boolean(group && user && group.memberIds.includes(user.id));
  const isOwner = Boolean(group && user?.id === group.ownerId);
  const { messages, loading: messagesLoading, sendMessage } = useGroupMessages(params.groupId, isMember);
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const join = async () => {
    if (!displayGroup || joining) return;
    setJoining(true);
    try {
      if (!group && systemSource) await createSystemGroup(systemSource.id);
      else await joinGroup(displayGroup);
      addToast({ message: displayGroup.privacy === 'open' ? 'You joined the group.' : 'Request sent to the group owner.', type: 'success', duration: 3000 });
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not update membership.', type: 'error', duration: 4000 });
    } finally {
      setJoining(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Opening group...</div>;
  if (!displayGroup) return <div className="p-8 text-sm text-muted-foreground">This group could not be found.</div>;

  const requested = Boolean(user && displayGroup.pendingMemberIds.includes(user.id));

  if (!isMember) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <Link href="/app/groups" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Groups</Link>
        <section className="mt-5 overflow-hidden border border-white/10 bg-card">
          <div className="min-h-64 sm:min-h-80 bg-[linear-gradient(135deg,#21162e_0%,#16131d_55%,#381127_100%)] flex items-end p-6 sm:p-10">
            <div className="max-w-2xl">
              <span className="w-14 h-14 flex items-center justify-center bg-primary text-white"><UsersRound size={28} /></span>
              <h1 className="mt-5 text-3xl sm:text-5xl font-bold text-white">{displayGroup.name}</h1>
              <p className="mt-3 text-sm sm:text-base leading-7 text-white/70">{displayGroup.description}</p>
            </div>
          </div>
          <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-semibold text-foreground">A space for useful, respectful conversation</p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-2"><MessageCircle size={16} /> Live discussion</span>
                <span className="inline-flex items-center gap-2"><ImagePlus size={16} /> Photos and GIFs</span>
                <span className="inline-flex items-center gap-2"><Video size={16} /> Videos</span>
                {displayGroup.privacy === 'private' && <span className="inline-flex items-center gap-2"><Lock size={16} /> Approval required</span>}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">{displayGroup.memberIds.length} {displayGroup.memberIds.length === 1 ? 'member' : 'members'}</p>
            </div>
            {requested ? (
              <span className="px-6 py-3 text-sm font-semibold text-muted-foreground glass-chip">Request pending</span>
            ) : (
              <button onClick={join} disabled={joining} className="px-8 py-3 brand-gradient text-white text-sm font-semibold disabled:opacity-50">
                {joining ? 'Joining...' : displayGroup.privacy === 'open' ? 'Join group' : 'Request to join'}
              </button>
            )}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col max-w-4xl mx-auto border-x border-white/10">
      <header className="p-4 border-b border-white/10 flex items-center gap-3 flex-shrink-0">
        <Link href="/app/groups" aria-label="Back to groups" className="w-9 h-9 glass-chip flex items-center justify-center text-foreground"><ArrowLeft size={17} /></Link>
        <span className="w-10 h-10 bg-primary text-white flex items-center justify-center"><UsersRound size={20} /></span>
        <div className="min-w-0 flex-1"><h1 className="font-bold text-foreground truncate">{displayGroup.name}</h1><button onClick={() => setMembersOpen(true)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">{displayGroup.memberIds.length} members {displayGroup.privacy === 'private' && '· Private'}</button></div>
      </header>

      {isOwner && displayGroup.pendingMemberIds.length > 0 && (
        <div className="p-3 border-b border-white/10 bg-sidebar-accent/50">
          <p className="text-xs font-semibold text-foreground">Membership requests</p>
          <div className="mt-2 flex flex-wrap gap-2">{displayGroup.pendingMemberIds.map((memberId) => <button key={memberId} onClick={() => approveRequest(displayGroup, memberId)} className="px-3 py-1.5 glass-chip text-xs text-foreground">Approve member</button>)}</div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {messagesLoading ? <p className="text-sm text-muted-foreground">Loading messages...</p> : messages.length === 0 ? <p className="h-full flex items-center justify-center text-sm text-muted-foreground">Start the conversation.</p> : messages.map((message) => {
          const mine = message.senderId === user?.id;
          return <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[78%] overflow-hidden ${mine ? 'brand-gradient text-white' : 'glass-chip text-foreground'}`}><div className="px-3 pt-2 text-xs font-semibold opacity-80">{mine ? 'You' : message.senderName}</div>{message.media && <div className="mt-2"><MessageMedia media={message.media} /></div>}{message.text && <p className="px-3 pt-2 text-sm whitespace-pre-wrap break-words">{message.text}</p>}<p className="px-3 pb-2 mt-1 text-[10px] text-right opacity-70">{timeLabel(message.timestamp)}</p></div></div>;
        })}
        <div ref={bottomRef} />
      </div>
      <MessageComposer placeholder={`Message ${displayGroup.name}`} sending={sending} onSend={async (text, media) => { setSending(true); try { await sendMessage(text, media); } finally { setSending(false); } }} />
      {membersOpen && <GroupMembersModal memberIds={displayGroup.memberIds} onClose={() => setMembersOpen(false)} />}
    </div>
  );
}
