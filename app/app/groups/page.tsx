'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Globe2, ImagePlus, Loader2, Lock, Plus, UsersRound } from 'lucide-react';
import { useToast } from '@/lib/stores';
import { groupMediaApi } from '@/lib/api';
import {
  SYSTEM_GROUPS,
  type GroupPrivacy,
  type InterestGroup,
  useGroupActions,
  useGroups,
} from '@/hooks/useGroups';

type GroupView = 'yours' | 'open' | 'interests';

function GroupCard({ group, system = false }: { group: InterestGroup; system?: boolean }) {
  return (
    <Link href={`/app/groups/${group.id}`} className="glass-card overflow-hidden flex flex-col min-h-64 hover:border-primary/40 transition">
      <div className="relative h-24 shrink-0 overflow-hidden brand-gradient">
        {group.coverUrl && <img src={group.coverUrl} alt="" className="h-full w-full object-cover" />}
        <span className="absolute right-3 top-3 rounded-full bg-black/55 px-2 py-1 text-xs text-white backdrop-blur-sm inline-flex items-center gap-1">
          {group.privacy === 'private' ? <Lock size={12} /> : <Globe2 size={12} />}
          {system ? 'Interest group' : group.privacy === 'private' ? 'Private' : 'Public'}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-5 pb-5">
        <span className="-mt-7 h-14 w-14 overflow-hidden rounded-full border-4 border-card brand-gradient text-white flex items-center justify-center z-10">
          {group.avatarUrl ? <img src={group.avatarUrl} alt="" className="h-full w-full object-cover" /> : <UsersRound size={24} />}
        </span>
        <h2 className="mt-3 font-bold text-card-foreground">{group.name}</h2>
        <p className="mt-1 text-sm leading-5 text-muted-foreground line-clamp-3">{group.description}</p>
        <p className="mt-auto pt-4 text-xs text-muted-foreground">{group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}</p>
        <span className="mt-3 text-sm font-semibold text-primary">Open group</span>
      </div>
    </Link>
  );
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { createGroup } = useGroupActions();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('private');
  const [saving, setSaving] = useState(false);
  const [avatar, setAvatar] = useState<{ file: File; preview: string } | null>(null);
  const [cover, setCover] = useState<{ file: File; preview: string } | null>(null);

  useEffect(() => () => { if (avatar) URL.revokeObjectURL(avatar.preview); }, [avatar]);
  useEffect(() => () => { if (cover) URL.revokeObjectURL(cover.preview); }, [cover]);

  const chooseImage = (
    file: File | undefined,
    setter: (value: { file: File; preview: string } | null) => void,
  ) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      addToast({ message: 'Group photos must be 10 MB or smaller.', type: 'error', duration: 4000 });
      return;
    }
    setter({ file, preview: URL.createObjectURL(file) });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setSaving(true);
    try {
      const [avatarUpload, coverUpload] = await Promise.all([
        avatar ? groupMediaApi.upload(avatar.file, 'avatar') : Promise.resolve(null),
        cover ? groupMediaApi.upload(cover.file, 'cover') : Promise.resolve(null),
      ]);
      const id = await createGroup(name, description, privacy, {
        avatarUrl: avatarUpload?.url ?? null,
        coverUrl: coverUpload?.url ?? null,
      });
      addToast({ message: 'Your group is ready.', type: 'success', duration: 3000 });
      router.push(`/app/groups/${id}`);
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not create the group.', type: 'error', duration: 4000 });
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card p-5 space-y-4 max-w-xl">
      <div className="flex items-center justify-between gap-4">
        <div><h2 className="font-bold text-card-foreground">Create a group</h2><p className="text-xs text-muted-foreground mt-1">Build a community where members can post and comment.</p></div>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
      <div className="relative mb-9 h-32 overflow-visible rounded-xl border border-border brand-gradient">
        {cover && <img src={cover.preview} alt="Group cover preview" className="h-full w-full rounded-xl object-cover" />}
        <label className="absolute right-3 top-3 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-black/65 px-3 py-2 text-xs font-semibold text-white backdrop-blur-sm">
          <ImagePlus size={15} /> {cover ? 'Change cover' : 'Add cover'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { chooseImage(event.target.files?.[0], setCover); event.target.value = ''; }} />
        </label>
        <label className="absolute -bottom-8 left-4 h-20 w-20 cursor-pointer overflow-hidden rounded-full border-4 border-card brand-gradient text-white flex items-center justify-center">
          {avatar ? <img src={avatar.preview} alt="Group display picture preview" className="h-full w-full object-cover" /> : <><UsersRound size={30} /><span className="sr-only">Add display picture</span></>}
          <span className="absolute inset-x-0 bottom-0 bg-black/65 py-1 text-center text-[10px] font-semibold">DP</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { chooseImage(event.target.files?.[0], setAvatar); event.target.value = ''; }} />
        </label>
      </div>
      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Group name" className="w-full px-3 py-2.5 glass-input text-sm text-foreground placeholder-muted-foreground" />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} rows={3} placeholder="What is this group about?" className="w-full px-3 py-2.5 glass-input text-sm text-foreground placeholder-muted-foreground resize-none" />
      <div className="grid grid-cols-2 gap-2">
        {(['private', 'open'] as const).map((option) => (
          <button key={option} type="button" onClick={() => setPrivacy(option)} className={`p-3 text-left text-sm transition ${privacy === option ? 'brand-gradient text-white' : 'glass-chip text-foreground'}`}>
            <span className="flex items-center gap-2 font-semibold">{option === 'private' ? <Lock size={15} /> : <Globe2 size={15} />}{option === 'private' ? 'Private group' : 'Public group'}</span>
            <span className={`block mt-1 text-xs ${privacy === option ? 'text-white/80' : 'text-muted-foreground'}`}>{option === 'private' ? 'People join by invite or approval' : 'Anyone can discover and join'}</span>
          </button>
        ))}
      </div>
      <button disabled={saving || !name.trim() || !description.trim()} className="w-full py-2.5 brand-gradient text-white text-sm font-semibold disabled:opacity-50">{saving ? <span className="inline-flex items-center gap-2"><Loader2 size={15} className="animate-spin" /> Creating...</span> : 'Create group'}</button>
    </form>
  );
}

export function GroupsHub({ embedded = false }: { embedded?: boolean }) {
  const params = useSearchParams();
  const { groups, loading } = useGroups();
  const { user, acceptInvite } = useGroupActions();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<GroupView>('yours');
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => { if (params.get('create') === '1' && user) setCreating(true); }, [params, user]);

  const interestGroups: InterestGroup[] = SYSTEM_GROUPS.map((source) => groups.find((group) => group.id === source.id) ?? {
    ...source, privacy: 'open', systemCreated: true, ownerId: null, adminIds: [], pendingAdminIds: [], acceptedAdminInviteMemberIds: [], rejectedAdminInviteMemberIds: [], avatarUrl: null, coverUrl: null, memberIds: [], pendingMemberIds: [], invitedMemberIds: [], acceptedInviteMemberIds: [], createdAt: null,
  });
  const personalGroups = groups.filter((group) => !group.systemCreated);
  const invitations = user ? personalGroups.filter((group) => group.invitedMemberIds.includes(user.id)) : [];
  const visible = useMemo(() => {
    if (view === 'interests') return interestGroups;
    if (view === 'open') return personalGroups.filter((group) => group.privacy === 'open');
    return user ? personalGroups.filter((group) => group.memberIds.includes(user.id)) : [];
  }, [view, interestGroups, personalGroups, user]);

  const accept = async (group: InterestGroup) => {
    setAccepting(group.id);
    try { await acceptInvite(group); addToast({ message: `You joined ${group.name}.`, type: 'success', duration: 3000 }); }
    catch (error) { addToast({ message: error instanceof Error ? error.message : 'Could not accept the invitation.', type: 'error', duration: 4000 }); }
    finally { setAccepting(null); }
  };

  return (
    <div id="groups" className={embedded ? 'mt-8' : 'max-w-7xl mx-auto py-6 px-4 sm:px-6 pb-24'}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-2xl sm:text-3xl font-bold text-foreground">Groups</h1><p className="mt-1 text-sm text-muted-foreground">Create communities, share posts, and join conversations.</p></div>
        <button onClick={() => user ? setCreating((open) => !open) : addToast({ message: 'Sign in to create a group.', type: 'info', duration: 3000 })} className="inline-flex items-center gap-2 px-4 py-2.5 brand-gradient text-white text-sm font-semibold"><Plus size={17} /> Create group</button>
      </div>

      {creating && <div className="mt-6"><CreateGroup onClose={() => setCreating(false)} /></div>}

      {invitations.length > 0 && (
        <section className="mt-8"><h2 className="text-lg font-bold text-foreground">Invitations</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{invitations.map((group) => <div key={group.id} className="glass-card p-4 flex items-center justify-between gap-4"><div className="min-w-0"><p className="font-semibold text-foreground truncate">{group.name}</p><p className="text-xs text-muted-foreground">You were invited to join</p></div><button onClick={() => void accept(group)} disabled={accepting === group.id} className="px-4 py-2 brand-gradient text-white text-sm font-semibold disabled:opacity-50">{accepting === group.id ? 'Joining...' : 'Accept'}</button></div>)}</div></section>
      )}

      <div className="mt-8 flex gap-1 border-b border-border overflow-x-auto">
        {([['interests', 'Interest groups'],['yours', 'Your groups'], ['open', 'Open groups']] as const).map(([id, label]) => <button key={id} onClick={() => setView(id)} className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 ${view === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{label}</button>)}
      </div>

      <section className="mt-5">
        <h2 className="text-lg font-bold text-foreground">{view === 'yours' ? 'Your groups' : view === 'open' ? 'Open groups' : 'Interest Groups'}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{view === 'yours' ? 'Groups you own or have joined.' : view === 'open' ? 'Public groups created by the community.' : 'Public communities curated by Signal Face.'}</p>
        {loading && view !== 'interests' ? <p className="mt-5 text-sm text-muted-foreground">Loading groups...</p> : visible.length === 0 ? <p className="mt-5 text-sm text-muted-foreground">{view === 'yours' ? 'You have not joined any groups yet.' : 'No groups are available here yet.'}</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visible.map((group) => <GroupCard key={group.id} group={group} system={view === 'interests'} />)}</div>}
      </section>
    </div>
  );
}

export default function GroupsPage() {
  return <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading groups...</div>}><GroupsHub /></Suspense>;
}
