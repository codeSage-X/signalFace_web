'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft, Camera, Globe2, Heart, ImagePlus, Loader2, Lock, MessageCircle,
  Share2,
  Send, UserPlus, UsersRound, Video, X,
} from 'lucide-react';
import { chatMediaApi, groupMediaApi, usersApi, type ChatMediaUpload, type FollowPerson } from '@/lib/api';
import { useToast } from '@/lib/stores';
import { GroupMembersModal } from '@/components/social/GroupMembersModal';
import { MessageMedia } from '@/components/chat/MessageMedia';
import { UserAvatar } from '@/components/UserAvatar';
import { PostShareModal } from '@/components/social/PostShareModal';
import {
  SYSTEM_GROUPS,
  type GroupPost,
  type InterestGroup,
  useGroup,
  useGroupActions,
  useGroupComments,
  useGroupPostLikes,
  useGroupPosts,
} from '@/hooks/useGroups';

function timeLabel(date: Date | null) {
  if (!date) return 'Publishing...';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' at ' +
    date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function PostComposer({ onCreate }: { onCreate: (text: string, media?: ChatMediaUpload) => Promise<void> }) {
  const { addToast } = useToast();
  const [text, setText] = useState('');
  const [media, setMedia] = useState<ChatMediaUpload | undefined>();
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const upload = async (file?: File) => {
    if (!file || uploading) return;
    setUploading(true);
    try {
      setMedia(await chatMediaApi.upload(file));
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not attach that media.', type: 'error', duration: 5000 });
    } finally {
      setUploading(false);
      if (imageRef.current) imageRef.current.value = '';
      if (videoRef.current) videoRef.current.value = '';
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if ((!text.trim() && !media) || saving || uploading) return;
    setSaving(true);
    try {
      await onCreate(text, media);
      setText('');
      setMedia(undefined);
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not publish your post.', type: 'error', duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card p-4">
      <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={4000} rows={3} placeholder="Share something with the group..." className="w-full resize-none bg-transparent text-sm text-foreground placeholder-muted-foreground outline-none" />
      {media && <div className="relative mt-3 w-fit overflow-hidden border border-border"><MessageMedia media={media} /><button type="button" onClick={() => setMedia(undefined)} aria-label="Remove attachment" className="absolute right-2 top-2 w-8 h-8 bg-black/70 text-white flex items-center justify-center"><X size={16} /></button></div>}
      {uploading && <p className="mt-2 text-xs text-muted-foreground">Uploading and checking media...</p>}
      <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
          <input ref={videoRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
          <button type="button" onClick={() => imageRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><ImagePlus size={18} /> Photo</button>
          <button type="button" onClick={() => videoRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground"><Video size={18} /> Video</button>
        </div>
        <button disabled={saving || uploading || (!text.trim() && !media)} className="px-5 py-2 brand-gradient text-white text-sm font-semibold disabled:opacity-40">{saving ? 'Posting...' : 'Post'}</button>
      </div>
    </form>
  );
}

function GroupPostCard({ groupId, groupName, post, isMember }: { groupId: string; groupName: string; post: GroupPost; isMember: boolean }) {
  const { comments, loading, addComment } = useGroupComments(groupId, post.id, isMember);
  const { likeCount, liked, toggleLike } = useGroupPostLikes(groupId, post.id, isMember);
  const { addToast } = useToast();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [likePending, setLikePending] = useState(false);

  const handleLike = async () => {
    if (likePending) return;
    setLikePending(true);
    try {
      await toggleLike();
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not update your like.', type: 'error', duration: 4000 });
    } finally {
      setLikePending(false);
    }
  };

  const [shareOpen, setShareOpen] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try { await addComment(draft); setDraft(''); } finally { setSending(false); }
  };

  return (
    <article id={`group-post-${post.id}`} className="glass-card overflow-hidden">
      <div className="p-4 flex items-center gap-3">
        <UserAvatar src={post.authorAvatarUrl} name={post.authorName} size="sm" />
        <div className="min-w-0"><p className="text-sm font-semibold text-foreground truncate">{post.authorName}</p><p className="text-xs text-muted-foreground">{timeLabel(post.createdAt)}</p></div>
      </div>
      {post.text && <p className="px-4 pb-4 text-sm leading-6 text-foreground whitespace-pre-wrap break-words">{post.text}</p>}
      {post.media && <div className="w-full bg-black/10 flex justify-center [&_img]:w-full [&_img]:max-h-[36rem] [&_video]:w-full [&_video]:max-h-[36rem]"><MessageMedia media={post.media} /></div>}
      <div className="border-t border-border grid grid-cols-3">
        <button onClick={() => void handleLike()} disabled={likePending} aria-label={liked ? 'Unlike post' : 'Like post'} className={`px-2 py-3 flex items-center justify-center gap-2 text-sm disabled:opacity-50 ${liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} /> {likeCount}
        </button>
        <button onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen} className="px-2 py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <MessageCircle size={17} /> {comments.length}
        </button>
        <button onClick={() => setShareOpen(true)} className="px-2 py-3 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Share2 size={17} /> Share
        </button>
      </div>
      {commentsOpen && (
        <div className="border-t border-border p-4 space-y-4">
          {loading ? <p className="text-xs text-muted-foreground">Loading comments...</p> : comments.length === 0 ? <p className="text-xs text-muted-foreground">Be the first to comment.</p> : comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-2.5"><UserAvatar src={comment.authorAvatarUrl} name={comment.authorName} size="sm" ring={false} className="!w-8 !h-8" /><div className="min-w-0 flex-1 bg-muted px-3 py-2"><p className="text-xs font-semibold text-foreground">{comment.authorName}</p><p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap break-words">{comment.text}</p></div></div>
          ))}
          <form onSubmit={submit} className="flex items-center gap-2">
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Write a comment..." className="min-w-0 flex-1 px-3 py-2 glass-input text-sm text-foreground placeholder-muted-foreground" />
            <button disabled={!draft.trim() || sending} aria-label="Post comment" className="w-10 h-10 brand-gradient text-white flex items-center justify-center disabled:opacity-40">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}</button>
          </form>
        </div>
      )}
      {shareOpen && <PostShareModal post={{
        id: post.id, title: `${post.authorName} in ${groupName}`, text: post.text ?? '',
        path: `/app/groups/${encodeURIComponent(groupId)}#group-post-${encodeURIComponent(post.id)}`,
        thumbnail: post.media?.moderationStatus === 'approved' && post.media.type === 'image' ? post.media.url : null,
        videos: post.media?.moderationStatus === 'approved' && post.media.type === 'video' ? [post.media.url] : [],
      }} onClose={() => setShareOpen(false)} />}
    </article>
  );
}

function InviteModal({ group, onClose }: { group: InterestGroup; onClose: () => void }) {
  const { inviteMember } = useGroupActions();
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FollowPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) { setResults([]); return; }
    const timer = setTimeout(() => {
      setLoading(true);
      usersApi.search(value, null, 10).then((page) => setResults(page.items)).catch(() => setResults([])).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const invite = async (person: FollowPerson) => {
    setPending(person.id);
    try { await inviteMember(group, person.id); addToast({ message: `Invitation sent to ${person.displayName}.`, type: 'success', duration: 3000 }); }
    catch (error) { addToast({ message: error instanceof Error ? error.message : 'Could not send the invitation.', type: 'error', duration: 4000 }); }
    finally { setPending(null); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center">
      <div className="glass-card w-full max-w-md max-h-[75vh] flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between"><h2 className="font-bold text-foreground">Invite people</h2><button onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        <div className="p-4"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or username" className="w-full px-3 py-2.5 glass-input text-sm text-foreground placeholder-muted-foreground" /></div>
        <div className="overflow-y-auto px-4 pb-4">
          {loading ? <p className="py-6 text-center text-sm text-muted-foreground">Searching...</p> : results.map((person) => {
            const unavailable = group.memberIds.includes(person.id) || group.invitedMemberIds.includes(person.id);
            return <div key={person.id} className="flex items-center gap-3 py-3 border-t border-border"><UserAvatar src={person.avatarUrl} name={person.displayName} size="sm" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-foreground truncate">{person.displayName}</p><p className="text-xs text-muted-foreground truncate">@{person.username}</p></div><button onClick={() => void invite(person)} disabled={unavailable || pending === person.id} className="px-3 py-2 brand-gradient text-white text-xs font-semibold disabled:opacity-40">{unavailable ? 'Invited' : pending === person.id ? 'Sending...' : 'Invite'}</button></div>;
          })}
        </div>
      </div>
    </div>
  );
}

export default function GroupPage() {
  const params = useParams<{ groupId: string }>();
  const { group, loading } = useGroup(params.groupId);
  const { user, joinGroup, approveRequest, createSystemGroup, updateGroupImages } = useGroupActions();
  const { addToast } = useToast();
  const systemSource = SYSTEM_GROUPS.find((entry) => entry.id === params.groupId);
  const displayGroup: InterestGroup | null = group ?? (systemSource ? {
    ...systemSource, privacy: 'open', systemCreated: true, ownerId: null, adminIds: [], pendingAdminIds: [], acceptedAdminInviteMemberIds: [], rejectedAdminInviteMemberIds: [], avatarUrl: null, coverUrl: null, memberIds: [], pendingMemberIds: [], invitedMemberIds: [], acceptedInviteMemberIds: [], createdAt: null,
  } : null);
  const isMember = Boolean(group && user && group.memberIds.includes(user.id));
  const isOwner = Boolean(group && user?.id === group.ownerId);
  const isGroupAdmin = Boolean(group && user && group.adminIds.includes(user.id));
  const canModerate = isOwner || isGroupAdmin;
  const canEditImages = Boolean(group && user && (
    group.privacy === 'private' ? canModerate : group.memberIds.includes(user.id)
  ));
  const { posts, loading: postsLoading, createPost } = useGroupPosts(params.groupId, isMember);
  const [joining, setJoining] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [uploadingGroupImage, setUploadingGroupImage] = useState<'avatar' | 'cover' | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Opening group...</div>;
  if (!displayGroup) return <div className="p-8 text-sm text-muted-foreground">This group could not be found.</div>;
  const requested = Boolean(user && displayGroup.pendingMemberIds.includes(user.id));

  const join = async () => {
    setJoining(true);
    try {
      if (!group && systemSource) await createSystemGroup(systemSource.id);
      else await joinGroup(displayGroup);
      addToast({ message: displayGroup.privacy === 'open' ? 'You joined the group.' : 'Request sent to the group owner.', type: 'success', duration: 3000 });
    } catch (error) { addToast({ message: error instanceof Error ? error.message : 'Could not join this group.', type: 'error', duration: 4000 }); }
    finally { setJoining(false); }
  };

  const uploadGroupImage = async (kind: 'avatar' | 'cover', file?: File) => {
    if (!file || !group || uploadingGroupImage) return;
    if (file.size > 10 * 1024 * 1024) {
      addToast({ message: 'Group photos must be 10 MB or smaller.', type: 'error', duration: 4000 });
      return;
    }
    setUploadingGroupImage(kind);
    try {
      const { url } = await groupMediaApi.upload(file, kind);
      await updateGroupImages(group, kind === 'avatar' ? { avatarUrl: url } : { coverUrl: url });
      addToast({ message: kind === 'avatar' ? 'Group display picture updated.' : 'Group cover updated.', type: 'success', duration: 3000 });
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not update the group photo.', type: 'error', duration: 5000 });
    } finally {
      setUploadingGroupImage(null);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-24">
      <Link href="/app/explore#groups" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Explore groups</Link>
      <header className="mt-4 overflow-hidden border border-border bg-card">
        <div className="relative h-40 sm:h-52 brand-gradient">
          {displayGroup.coverUrl && <img src={displayGroup.coverUrl} alt={`${displayGroup.name} cover`} className="h-full w-full object-cover" />}
          {canEditImages && (
            <button type="button" onClick={() => coverInputRef.current?.click()} disabled={Boolean(uploadingGroupImage)} className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-lg bg-black/65 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm disabled:opacity-60">
              {uploadingGroupImage === 'cover' ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />}
              {displayGroup.coverUrl ? 'Change cover' : 'Add cover'}
            </button>
          )}
          <input ref={coverInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void uploadGroupImage('cover', event.target.files?.[0])} />
        </div>
        <div className="relative px-5 pb-5 sm:px-7 sm:pb-7">
          <div className="absolute -top-12 left-5 sm:left-7 h-24 w-24 overflow-hidden rounded-full border-4 border-card brand-gradient text-white flex items-center justify-center">
            {displayGroup.avatarUrl ? <img src={displayGroup.avatarUrl} alt={`${displayGroup.name} display picture`} className="h-full w-full object-cover" /> : <UsersRound size={38} />}
            {canEditImages && <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={Boolean(uploadingGroupImage)} aria-label="Change group display picture" className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-100 sm:opacity-0 sm:hover:opacity-100 focus-visible:opacity-100 transition disabled:opacity-60">{uploadingGroupImage === 'avatar' ? <Loader2 size={22} className="animate-spin" /> : <Camera size={22} />}</button>}
            <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void uploadGroupImage('avatar', event.target.files?.[0])} />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 pt-16">
            <div><h1 className="text-2xl sm:text-3xl font-bold text-foreground">{displayGroup.name}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{displayGroup.description}</p><button onClick={() => group && setMembersOpen(true)} disabled={!group} className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"><UsersRound size={14} /> {displayGroup.memberIds.length} members · {displayGroup.privacy === 'private' ? <><Lock size={12} /> Private group</> : <><Globe2 size={12} /> Public group</>}</button></div>
            {isMember ? <button onClick={() => setInviteOpen(true)} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 glass-chip text-foreground text-sm font-semibold"><UserPlus size={17} /> Invite people</button> : requested ? <span className="px-4 py-2.5 glass-chip text-sm text-muted-foreground">Request pending</span> : <button onClick={() => void join()} disabled={joining} className="px-6 py-2.5 brand-gradient text-white text-sm font-semibold disabled:opacity-50">{joining ? 'Joining...' : displayGroup.privacy === 'open' ? 'Join group' : 'Request to join'}</button>}
          </div>
        </div>
      </header>

      {canModerate && displayGroup.pendingMemberIds.length > 0 && <section className="mt-4 glass-card p-4"><h2 className="text-sm font-bold text-foreground">Membership requests</h2><div className="mt-3 flex flex-wrap gap-2">{displayGroup.pendingMemberIds.map((memberId) => <button key={memberId} onClick={() => approveRequest(displayGroup, memberId)} className="px-3 py-2 glass-chip text-xs text-foreground">Approve member</button>)}</div></section>}

      {isMember ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start">
          <main className="min-w-0 space-y-4"><PostComposer onCreate={createPost} />{postsLoading ? <div className="glass-card h-40 animate-pulse" /> : posts.length === 0 ? <div className="border border-border p-10 text-center"><p className="font-semibold text-foreground">No posts yet</p><p className="mt-1 text-sm text-muted-foreground">Start the conversation with the first group post.</p></div> : posts.map((post) => <GroupPostCard key={post.id} groupId={params.groupId} groupName={displayGroup.name} post={post} isMember={isMember} />)}</main>
          <aside className="border border-border bg-card p-4"><h2 className="text-sm font-bold text-foreground">About this group</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">Members can publish text, photos, and videos, then discuss each post in its comments.</p></aside>
        </div>
      ) : <div className="mt-5 border border-border p-8 text-center"><p className="font-semibold text-foreground">Join to see group posts</p><p className="mt-1 text-sm text-muted-foreground">{displayGroup.privacy === 'private' ? 'Private group posts are visible to approved members.' : 'Become a member to publish and join the discussion.'}</p></div>}

      {membersOpen && group && <GroupMembersModal group={group} onClose={() => setMembersOpen(false)} />}
      {inviteOpen && group && <InviteModal group={group} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}
