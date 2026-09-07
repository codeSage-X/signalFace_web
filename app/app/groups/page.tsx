'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Plus, UsersRound } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/lib/stores';
import {
  SYSTEM_GROUPS,
  type GroupPrivacy,
  type InterestGroup,
  useGroupActions,
  useGroups,
} from '@/hooks/useGroups';

function GroupCard({ group, system, onBootstrap }: { group: InterestGroup; system?: boolean; onBootstrap?: () => Promise<void> }) {
  const { user, joinGroup } = useGroupActions();
  const { addToast } = useToast();
  const isMember = Boolean(user && group.memberIds.includes(user.id));
  const requested = Boolean(user && group.pendingMemberIds.includes(user.id));

  const join = async () => {
    try {
      if (onBootstrap) {
        await onBootstrap();
        return;
      }
      await joinGroup(group);
      addToast({ message: group.privacy === 'open' ? 'You joined the group.' : 'Request sent to the group owner.', type: 'success', duration: 3000 });
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not update group membership.', type: 'error', duration: 4000 });
    }
  };

  return (
    <article className="glass-card rounded-xl p-5 flex flex-col min-h-56">
      <div className="flex items-start justify-between gap-3">
        <span className="w-10 h-10 rounded-lg brand-gradient text-white flex items-center justify-center">
          <UsersRound size={20} />
        </span>
        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
          {group.privacy === 'private' && <Lock size={12} />}
          {system ? 'System group' : group.privacy === 'private' ? 'Private group' : 'Open group'}
        </span>
      </div>
      <h2 className="mt-4 font-bold text-card-foreground">{group.name}</h2>
      <p className="mt-1 text-sm leading-5 text-muted-foreground line-clamp-3">{group.description}</p>
      <p className="mt-auto pt-4 text-xs text-muted-foreground">
        {group.memberIds.length} {group.memberIds.length === 1 ? 'member' : 'members'}
      </p>
      {isMember ? (
        <Link href={`/app/groups/${group.id}`} className="mt-3 py-2 rounded-lg text-center text-sm font-semibold brand-gradient text-white hover:brightness-110 transition">
          Open discussion
        </Link>
      ) : requested ? (
        <span className="mt-3 py-2 rounded-lg text-center text-sm font-semibold glass-chip text-muted-foreground">Request sent</span>
      ) : (
        <button onClick={join} className="mt-3 py-2 rounded-lg text-sm font-semibold glass-chip text-foreground hover:brightness-110 transition">
          {group.privacy === 'open' ? 'Join group' : 'Request to join'}
        </button>
      )}
    </article>
  );
}

function CreateGroup({ onClose }: { onClose: () => void }) {
  const { createGroup } = useGroupActions();
  const { addToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState<GroupPrivacy>('private');
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !description.trim()) return;
    setSaving(true);
    try {
      await createGroup(name, description, privacy);
      addToast({ message: 'Your group is ready.', type: 'success', duration: 3000 });
      onClose();
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not create the group.', type: 'error', duration: 4000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-bold text-card-foreground">Create a group</h2>
        <button type="button" onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Group name" className="w-full px-3 py-2.5 rounded-lg glass-input text-sm text-foreground placeholder-muted-foreground" />
      <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} rows={3} placeholder="What will members discuss?" className="w-full px-3 py-2.5 rounded-lg glass-input text-sm text-foreground placeholder-muted-foreground resize-none" />
      <div className="grid grid-cols-2 gap-2">
        {(['private', 'open'] as const).map((option) => (
          <button key={option} type="button" onClick={() => setPrivacy(option)} className={`p-3 rounded-lg text-left text-sm transition ${privacy === option ? 'brand-gradient text-white' : 'glass-chip text-foreground'}`}>
            <span className="block font-semibold capitalize">{option}</span>
            <span className={`block mt-0.5 text-xs ${privacy === option ? 'text-white/80' : 'text-muted-foreground'}`}>
              {option === 'private' ? 'Approve requests yourself' : 'Anyone can join'}
            </span>
          </button>
        ))}
      </div>
      <button disabled={saving || !name.trim() || !description.trim()} className="w-full py-2.5 rounded-lg brand-gradient text-white text-sm font-semibold disabled:opacity-50">
        {saving ? 'Creating...' : 'Create group'}
      </button>
    </form>
  );
}

function GroupsPageInner() {
  const params = useSearchParams();
  const { groups, loading } = useGroups();
  const { createSystemGroup, user } = useGroupActions();
  const { addToast } = useToast();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (params.get('create') === '1' && user) setCreating(true);
  }, [params, user]);
  const configuredSystemGroups = SYSTEM_GROUPS.map((source) => groups.find((group) => group.id === source.id) ?? {
    ...source, privacy: 'open' as const, systemCreated: true, ownerId: null, memberIds: [], pendingMemberIds: [], createdAt: null,
  });
  const personalGroups = groups.filter((group) => !group.systemCreated);

  const openSystemGroup = async (id: string) => {
    try {
      await createSystemGroup(id);
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not prepare this group.', type: 'error', duration: 4000 });
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Groups</h1>
          <p className="mt-1 text-sm text-muted-foreground">Join conversations around what matters to you.</p>
        </div>
        <button onClick={() => user ? setCreating((open) => !open) : addToast({ message: 'Sign in to create a group.', type: 'info', duration: 3000 })} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg brand-gradient text-white text-sm font-semibold">
          <Plus size={17} /> Create group
        </button>
      </div>

      {creating && <div className="mt-6 max-w-xl"><CreateGroup onClose={() => setCreating(false)} /></div>}

      <section className="mt-8">
        <h2 className="text-lg font-bold text-foreground">Featured communities</h2>
        <p className="mt-1 text-sm text-muted-foreground">Open groups created and moderated by Signal Face.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {configuredSystemGroups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              system
              onBootstrap={group.createdAt === null ? () => openSystemGroup(group.id) : undefined}
            />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-bold text-foreground">Member-created groups</h2>
        {loading ? <p className="mt-4 text-sm text-muted-foreground">Loading groups...</p> : personalGroups.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No member-created groups yet. Start the first one.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {personalGroups.map((group) => <GroupCard key={group.id} group={group} />)}
          </div>
        )}
      </section>
    </div>
  );
}

export default function GroupsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading groups...</div>}>
      <GroupsPageInner />
    </Suspense>
  );
}