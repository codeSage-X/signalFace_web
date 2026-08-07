'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import {
  ApiError,
  REALM_CATEGORIES,
  REALM_CATEGORY_LABELS,
  realmsApi,
  type FeedPost,
  type Realm,
  type RealmCategory,
} from '@/lib/api';
import { useAuth, useProfileMode, useToast } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';
import { RealmPostGrid } from '@/components/creator/RealmPostGrid';
import {
  BadgeCheck,
  Camera,
  Check,
  ExternalLink,
  Eye,
  ImagePlus,
  LayoutDashboard,
  Link2,
  Loader2,
  Pencil,
  Rocket,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';

const PAGE_SIZE = 12;
const TABS = ['Posts', 'About'] as const;
type Tab = (typeof TABS)[number];

export default function CreatorRealmPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const setRealm = useProfileMode((s) => s.setRealm);
  const setBecomeCreatorOpen = useProfileMode((s) => s.setBecomeCreatorOpen);
  const { mode, realm, isCreator, switchTo } = useProfileSwitch();

  const [tab, setTab] = useState<Tab>('Posts');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    category: 'OTHER' as RealmCategory,
    tagline: '',
    description: '',
    websiteUrl: '',
  });

  const slug = realm?.slug;
  // Management is gated on actually being switched into the creator profile —
  // the same rule Facebook applies to Page admin actions.
  const canManage = mode === 'creator';

  useEffect(() => {
    if (!realm) return;
    setForm({
      name: realm.name,
      category: realm.category,
      tagline: realm.tagline ?? '',
      description: realm.description ?? '',
      websiteUrl: realm.websiteUrl ?? '',
    });
  }, [realm]);

  useEffect(() => {
    if (!slug) {
      setPostsLoading(false);
      return;
    }

    let cancelled = false;
    setPostsLoading(true);

    realmsApi
      .posts(slug, null, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) {
          addToast({ message: 'Could not load your realm posts.', type: 'error', duration: 4000 });
        }
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, addToast]);

  const loadMore = useCallback(async () => {
    if (!slug || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await realmsApi.posts(slug, nextCursor, PAGE_SIZE);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more posts.', type: 'error', duration: 4000 });
    } finally {
      setLoadingMore(false);
    }
  }, [slug, nextCursor, loadingMore, addToast]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await realmsApi.update({
        name: form.name.trim(),
        category: form.category,
        tagline: form.tagline.trim(),
        description: form.description.trim(),
        ...(form.websiteUrl.trim() ? { websiteUrl: form.websiteUrl.trim() } : {}),
      });
      setRealm(updated);
      setEditing(false);
      addToast({ message: 'Realm updated.', type: 'success', duration: 3000 });
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not update your realm.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleImage = async (kind: 'avatar' | 'cover', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploading(kind);
    try {
      const updated =
        kind === 'avatar'
          ? await realmsApi.uploadAvatar(file)
          : await realmsApi.uploadCover(file);
      setRealm(updated);
      addToast({
        message: kind === 'avatar' ? 'Realm avatar updated.' : 'Cover photo updated.',
        type: 'success',
        duration: 3000,
      });
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not upload the image.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setUploading(null);
    }
  };

  const handleShare = () => {
    if (!slug) return;
    navigator.clipboard?.writeText(`${window.location.origin}/app/r/${slug}`);
    addToast({ message: 'Realm link copied!', type: 'info', duration: 2500 });
  };

  // ── No realm yet: pitch the upgrade rather than showing an empty page.
  if (!isCreator || !realm) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-full brand-gradient flex items-center justify-center mb-5">
            <Sparkles size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">You don&apos;t have a realm yet</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            A realm is your creator page — your own name, handle, cover art and a tradable
            Signal that grows as your audience does.
          </p>
          <button
            onClick={() => setBecomeCreatorOpen(true)}
            className="mt-6 px-6 py-3 rounded-xl font-semibold text-white text-sm brand-gradient brand-glow hover:brightness-110 transition"
          >
            Become a creator
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full pb-12">
      {/* ── Cover ─────────────────────────────────────────────────────────── */}
      <div className="relative h-40 sm:h-56 lg:h-64 w-full overflow-hidden bg-gradient-to-br from-violet-900 via-fuchsia-900 to-rose-900">
        {realm.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={realm.coverUrl} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />

        {canManage && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handleImage('cover', e)}
              className="hidden"
            />
            {/* Centred, not top-right: the top-right corner belongs to the app's
                fixed notification/settings pill, which sat directly on top of
                this button. The wrapper is inert so it doesn't swallow clicks
                across the whole cover. */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploading !== null}
                className="glass-chip pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full text-white text-xs font-medium hover:brightness-125 transition disabled:opacity-60"
              >
                {uploading === 'cover' ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <ImagePlus size={13} />
                )}
                {realm.coverUrl ? 'Change cover' : 'Add cover'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="px-6 lg:px-10">
        {/* ── Identity row ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14 relative">
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl brand-gradient flex items-center justify-center text-3xl font-bold text-white overflow-hidden ring-4 ring-background">
              {realm.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                realm.name.charAt(0).toUpperCase()
              )}
            </div>

            {canManage && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImage('avatar', e)}
                  className="hidden"
                />
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading !== null}
                  aria-label="Change realm avatar"
                  className="absolute -bottom-1 -right-1 w-8 h-8 brand-gradient rounded-full flex items-center justify-center shadow-lg hover:brightness-110 transition disabled:opacity-60"
                >
                  {uploading === 'avatar' ? (
                    <Loader2 size={13} className="text-white animate-spin" />
                  ) : (
                    <Camera size={13} className="text-white" />
                  )}
                </button>
              </>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-foreground">{realm.name}</h1>
              <BadgeCheck size={18} className="text-primary flex-shrink-0" />
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sidebar-accent text-foreground">
                {REALM_CATEGORY_LABELS[realm.category]}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">@{realm.slug}</p>
            {realm.tagline && (
              <p className="mt-1.5 text-sm text-foreground max-w-xl">{realm.tagline}</p>
            )}
          </div>
        </div>

        {/* ── Viewing-as banner ───────────────────────────────────────────── */}
        {!canManage && (
          <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl glass-brand">
            <Eye size={16} className="text-primary flex-shrink-0" />
            <p className="flex-1 text-sm text-foreground">
              You&apos;re viewing this page as{' '}
              <span className="font-semibold">@{user?.username}</span>. Switch to your creator
              profile to post, edit or boost.
            </p>
            <button
              onClick={() => switchTo('creator')}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white brand-gradient hover:brightness-110 transition whitespace-nowrap"
            >
              Switch to {realm.name}
            </button>
          </div>
        )}

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
          <Stat icon={Users} value={realm.followersCount.toLocaleString()} label="Followers" />
          <Stat icon={ImagePlus} value={realm.postsCount.toLocaleString()} label="Posts" />
          {realm.signal && (
            <Stat
              icon={TrendingUp}
              value={`$${Number(realm.signal.price).toFixed(2)}`}
              label="Signal price"
            />
          )}
        </div>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <NextLink
                href="/app/upload?as=realm"
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white brand-gradient hover:brightness-110 transition"
              >
                <ImagePlus size={14} />
                Create post
              </NextLink>
              <button
                onClick={() => setEditing((v) => !v)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium glass-chip text-foreground hover:brightness-125 transition"
              >
                <Pencil size={13} />
                {editing ? 'Cancel' : 'Edit page'}
              </button>
              <button
                onClick={() =>
                  addToast({
                    message: 'Realm boosting is coming soon.',
                    type: 'info',
                    duration: 3000,
                  })
                }
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium glass-chip text-foreground hover:brightness-125 transition"
              >
                <Rocket size={13} />
                Boost
              </button>
            </>
          )}

          <NextLink
            href="/app/realm/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium glass-chip text-foreground hover:brightness-125 transition"
          >
            <LayoutDashboard size={13} />
            Dashboard
          </NextLink>

          <button
            onClick={handleShare}
            aria-label="Copy realm link"
            className="w-9 h-9 flex items-center justify-center rounded-xl glass-chip hover:brightness-125 transition"
          >
            <Share2 size={14} className="text-foreground" />
          </button>

          {canManage && (
            <button
              onClick={() => switchTo('fan')}
              className="ml-auto text-sm font-medium text-primary hover:underline"
            >
              Switch back to fan profile
            </button>
          )}
        </div>

        {/* ── Edit form ───────────────────────────────────────────────────── */}
        {editing && canManage && (
          <div className="mt-5 p-5 glass-card rounded-xl space-y-4 max-w-xl">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Realm name
              </label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as RealmCategory }))
                }
                className={inputClass}
              >
                {REALM_CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-card text-foreground">
                    {REALM_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Tagline</label>
              <input
                value={form.tagline}
                onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                placeholder="One line on what you make"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">About</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                placeholder="Tell fans what your realm is about..."
                className={`${inputClass} resize-none`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Website</label>
              <input
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                placeholder="https://yoursite.com"
                className={inputClass}
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white text-sm brand-gradient hover:brightness-110 transition disabled:opacity-70"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}

        {/* ── Tabs ────────────────────────────────────────────────────────── */}
        <div className="mt-6 flex border-b border-border">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === t
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pt-4">
          {tab === 'Posts' ? (
            <RealmPostGrid
              posts={posts}
              loading={postsLoading}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              emptyTitle="No realm posts yet"
              emptyBody={
                canManage
                  ? 'Posts you publish as this realm show up here — and appear as the realm everywhere else.'
                  : 'Switch to your creator profile to publish your first realm post.'
              }
              emptyAction={
                canManage ? { href: '/app/upload?as=realm', label: 'Create your first post' } : undefined
              }
            />
          ) : (
            <AboutPanel realm={realm} />
          )}
        </div>
      </div>
    </div>
  );
}

const inputClass =
  'w-full px-4 py-2.5 glass-input rounded-xl text-foreground placeholder-muted-foreground text-sm';

const Stat = ({
  icon: Icon,
  value,
  label,
}: {
  icon: typeof Users;
  value: string;
  label: string;
}) => (
  <div className="flex items-center gap-2">
    <Icon size={15} className="text-muted-foreground" />
    <span className="font-bold text-foreground">{value}</span>
    <span className="text-sm text-muted-foreground">{label}</span>
  </div>
);

const AboutPanel = ({ realm }: { realm: Realm }) => (
  <div className="max-w-xl space-y-4 py-2">
    <Row label="Category" value={REALM_CATEGORY_LABELS[realm.category]} />
    <Row label="Handle" value={`@${realm.slug}`} />
    <Row
      label="Created"
      value={new Date(realm.createdAt).toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })}
    />
    <Row label="Owner" value={`@${realm.owner.username}`} />

    {realm.websiteUrl && (
      <div>
        <p className="text-xs text-muted-foreground mb-1">Website</p>
        <a
          href={realm.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          <Link2 size={13} />
          {realm.websiteUrl.replace(/^https?:\/\//, '')}
          <ExternalLink size={11} />
        </a>
      </div>
    )}

    {realm.description ? (
      <div>
        <p className="text-xs text-muted-foreground mb-1">About</p>
        <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
          {realm.description}
        </p>
      </div>
    ) : (
      <p className="text-sm text-muted-foreground italic">No description yet.</p>
    )}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
    <p className="text-sm text-foreground">{value}</p>
  </div>
);
