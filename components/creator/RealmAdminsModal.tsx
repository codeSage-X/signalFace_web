'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { realmsApi, usersApi, type FollowPerson, type Realm, type RealmAdmin } from '@/lib/api';
import { useToast } from '@/lib/stores';

export function RealmAdminsModal({
  realm,
  onClose,
  onCountChange,
}: {
  realm: Realm;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  const { addToast } = useToast();
  const [admins, setAdmins] = useState<RealmAdmin[]>([]);
  const [limit, setLimit] = useState(5);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FollowPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    realmsApi.admins()
      .then((response) => { setAdmins(response.items); setLimit(response.limit); })
      .catch((error) => addToast({ message: error instanceof Error ? error.message : 'Could not load page admins.', type: 'error', duration: 4000 }))
      .finally(() => setLoading(false));
  }, [addToast]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) { setResults([]); return; }
    const timer = window.setTimeout(() => {
      setSearching(true);
      usersApi.search(term, null, 12)
        .then((page) => setResults(page.items))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const adminIds = useMemo(() => new Set(admins.map((admin) => admin.id)), [admins]);
  const candidates = results.filter((person) => person.id !== realm.owner.id && !adminIds.has(person.id));

  const add = async (person: FollowPerson) => {
    setPending(person.id);
    try {
      const response = await realmsApi.addAdmin(person.id);
      setAdmins(response.items); setLimit(response.limit); setQuery(''); setResults([]); onCountChange?.(response.items.filter((admin) => admin.status === 'ACCEPTED').length);
      addToast({ message: `Admin invitation sent to ${person.displayName}.`, type: 'success', duration: 3000 });
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not add this admin.', type: 'error', duration: 4000 });
    } finally { setPending(null); }
  };

  const remove = async (admin: RealmAdmin) => {
    setPending(admin.id);
    try {
      const response = await realmsApi.removeAdmin(admin.id);
      setAdmins(response.items); setLimit(response.limit); onCountChange?.(response.items.filter((item) => item.status === 'ACCEPTED').length);
      addToast({ message: `${admin.displayName} is no longer a page admin.`, type: 'success', duration: 3000 });
    } catch (error) {
      addToast({ message: error instanceof Error ? error.message : 'Could not remove this admin.', type: 'error', duration: 4000 });
    } finally { setPending(null); }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="realm-admins-title" className="glass-card flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <div><h2 id="realm-admins-title" className="font-bold text-foreground">Page admins</h2><p className="mt-0.5 text-xs text-muted-foreground">{admins.length}/{limit} accepted or pending for {realm.name}</p></div>
          <button onClick={onClose} aria-label="Close page admins" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={18} /></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">
          <p className="mb-3 text-xs leading-5 text-muted-foreground">The person must accept your invitation before they can edit the page, publish as the Realm, or moderate its posts.</p>
          <div className="relative"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} disabled={admins.length >= limit} placeholder={admins.length >= limit ? 'Admin limit reached' : 'Search people to add'} className="glass-input w-full rounded-xl py-2.5 pl-9 pr-3 text-sm" /></div>
          {(searching || loading) && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading…</p>}
          {!!candidates.length && <div className="mt-3 rounded-xl border border-border">{candidates.map((person) => <div key={person.id} className="flex items-center gap-3 border-b border-border p-3 last:border-0"><UserAvatar src={person.avatarUrl} name={person.displayName} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{person.displayName}</p><p className="truncate text-xs text-muted-foreground">@{person.username}</p></div><button onClick={() => void add(person)} disabled={pending === person.id || admins.length >= limit} className="inline-flex items-center gap-1 rounded-lg brand-gradient px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{pending === person.id ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />} Add</button></div>)}</div>}
          <h3 className="mt-5 text-sm font-semibold text-foreground">Current admins</h3>
          {admins.length === 0 && !loading ? <p className="mt-3 text-sm text-muted-foreground">No admin invitations have been sent.</p> : <div className="mt-2 divide-y divide-border">{admins.map((admin) => <div key={admin.id} className="flex items-center gap-3 py-3"><UserAvatar src={admin.avatarUrl} name={admin.displayName} size="sm" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{admin.displayName}</p><p className="truncate text-xs text-muted-foreground">@{admin.username} · {admin.status === 'PENDING' ? 'Invited' : 'Admin'}</p></div><button onClick={() => void remove(admin)} disabled={pending === admin.id} aria-label={`Remove ${admin.displayName} as admin`} className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-40">{pending === admin.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}</button></div>)}</div>}
        </div>
      </section>
    </div>
  );
}
