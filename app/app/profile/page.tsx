'use client';

/**
 * Fan Account Profile - User's personal profile for posting, following, and interacting.
 * This is NOT a creator profile. To become a creator, users must create a Realm at /app/realm.
 * Only Realms own Signals and generate creator value.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { useAuth } from '@/lib/stores';
import { useToast } from '@/lib/stores';
import {
  usersApi,
  postsApi,
  walletApi,
  ApiError,
  type FeedPost,
  type Page,
  type WalletOverview,
  type WalletTransaction,
  type WalletTransactionType,
} from '@/lib/api';
import { ImmersiveFeed } from '@/components/feed/ImmersiveFeed';
import {
  Share2,
  Link2,
  Play,
  ChevronDown,
  Rocket,
  Repeat2,
  Heart,
  Bookmark,
  Camera,
  Check,
  Pencil,
  Loader2,
  LayoutGrid,
  UserCircle,
  FileText,
  Eye,
  Image as ImageIcon,
  Pin,
  PinOff,
  Trash2,
  BookmarkX,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react';
import {
  displayUrl,
  externalHref,
  formatSignalFaceCoins,
  nairaToSignalFaceCoins,
} from '@/lib/utils';
import { FollowersFollowingModal } from '@/components/social/FollowersFollowingModal';
import { naira } from '@/components/dashboard/SignalMarketCard';

const MAX_PINNED_POSTS = 3;
const PAGE_SIZE = 12;
const TABS = ['Posts', 'Portfolio', 'Reposts', 'Favorites', 'Liked'] as const;

type Tab = (typeof TABS)[number];

/** The three tabs that read a saved collection rather than the user's own posts. */
type CollectionTab = Exclude<Tab, 'Posts' | 'Portfolio'>;

const COLLECTION_FETCHERS: Record<
  CollectionTab,
  (cursor: string | null, limit?: number) => Promise<Page<FeedPost>>
> = {
  Reposts: (cursor, limit) => postsApi.reposts(cursor, limit),
  Favorites: (cursor, limit) => postsApi.bookmarks(cursor, limit),
  Liked: (cursor, limit) => postsApi.liked(cursor, limit),
};

const COLLECTION_EMPTY_COPY: Record<CollectionTab, { title: string; body: string }> = {
  Reposts: {
    title: 'No reposts yet',
    body: 'Repost a post and it will show up here on your profile.',
  },
  Favorites: {
    title: 'No favorites yet',
    body: 'Tap the bookmark icon on any post to save it here.',
  },
  Liked: {
    title: 'No liked posts yet',
    body: 'Posts you like will collect here.',
  },
};

interface CollectionState {
  items: FeedPost[];
  cursor: string | null;
  loading: boolean;
  loaded: boolean;
}

const EMPTY_COLLECTION: CollectionState = {
  items: [],
  cursor: null,
  loading: false,
  loaded: false,
};

const isCollectionTab = (tab: Tab): tab is CollectionTab =>
  tab !== 'Posts' && tab !== 'Portfolio';

const PROFILE_TXN_LABELS: Record<WalletTransactionType, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRADE_BUY: 'Signal purchase',
  TRADE_SELL: 'Signal sale',
  TRANSFER_SENT: 'SC sent',
  TRANSFER_RECEIVED: 'SC received',
  SIGNUP_BONUS: 'Signup reward',
  REFERRAL_BONUS: 'Referral reward',
  ADMIN_ADJUST: 'Wallet adjustment',
  REWARD_CLAIM: 'Reward claimed',
};

function formatNaira(raw: string | number) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return '₦0.00';
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  return `${sign}₦${Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function compactDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ProfilePage() {
  const { user, updateUser, isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('Posts');
  const [isEditing, setIsEditing] = useState(false);
  const [bioInput, setBioInput] = useState(user?.bio ?? '');
  const [linkInput, setLinkInput] = useState(user?.websiteUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [followModal, setFollowModal] = useState<{ tab: 'followers' | 'following' } | null>(null);
  const [profileWallet, setProfileWallet] = useState<WalletOverview | null>(null);
  const [profileTransactions, setProfileTransactions] = useState<WalletTransaction[]>([]);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Posts grid
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Reposts / Favorites / Liked are the same grid over three endpoints, so they
  // share one shape and are each loaded lazily the first time their tab opens.
  const [collections, setCollections] = useState<Record<CollectionTab, CollectionState>>({
    Reposts: EMPTY_COLLECTION,
    Favorites: EMPTY_COLLECTION,
    Liked: EMPTY_COLLECTION,
  });
  // Which post the immersive viewer opened on, and from which tab's list.
  const [viewer, setViewer] = useState<{ tab: Tab; index: number } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Read inside the observer callback so it never needs to be a dependency.
  const loadingMoreRef = useRef(false);

  const username = user?.username;
  const pinnedCount = posts.filter((p) => p.pinned).length;

  const bio = user?.bio ?? '';
  const link = user?.websiteUrl ?? '';

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '??';

  useEffect(() => {
    // Hooks run before this component's signed-out early return, so the guard
    // has to be here too — otherwise a logged-out visitor still fires /users/me.
    if (!isAuthenticated) return;

    usersApi
      .getMe()
      .then((profile) => updateUser(profile))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Close the profile actions menu on an outside click or Escape.
  useEffect(() => {
    if (!moreMenuOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (!moreMenuRef.current?.contains(e.target as Node)) setMoreMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [moreMenuOpen]);

  // First page — refetches if the username changes (e.g. after account edit).
  useEffect(() => {
    if (!username) return;

    let cancelled = false;
    setPostsLoading(true);
    setPostsError(null);

    postsApi
      .byUsername(username, null, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => {
        if (cancelled) return;
        setPostsError(err instanceof Error ? err.message : 'Could not load your posts.');
      })
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  const loadMore = useCallback(async () => {
    if (!username || !nextCursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await postsApi.byUsername(username, nextCursor, PAGE_SIZE);
      // Guard against duplicates if a cursor is ever served twice.
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not load more posts.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [username, nextCursor, addToast]);

  // Infinite scroll: pull the next page when the sentinel enters the viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor || activeTab !== 'Posts') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadMore, activeTab]);

  const patchCollection = useCallback((tab: CollectionTab, patch: Partial<CollectionState>) => {
    setCollections((prev) => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));
  }, []);

  /**
   * Tabs whose first page has already been requested.
   *
   * A ref rather than reading `collections.loaded`, because this effect writes to
   * `collections` — depending on it meant every write re-ran the effect, which
   * fired another request before `loaded` could flip, in an unbounded loop.
   */
  const requestedRef = useRef<Set<CollectionTab>>(new Set());
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  // A collection is only fetched once its tab is actually opened.
  useEffect(() => {
    if (!isAuthenticated || !isCollectionTab(activeTab)) return;

    const tab = activeTab;
    if (requestedRef.current.has(tab)) return;
    requestedRef.current.add(tab);

    patchCollection(tab, { loading: true });

    COLLECTION_FETCHERS[tab](null, PAGE_SIZE)
      .then((page) => {
        // Written even if the user has since switched tabs: the result is stored
        // under its own tab, so a late arrival lands in the right place.
        if (mountedRef.current) {
          patchCollection(tab, { items: page.items, cursor: page.nextCursor, loaded: true });
        }
      })
      .catch((err) => {
        // Clear the mark so returning to the tab retries rather than showing
        // an empty grid forever.
        requestedRef.current.delete(tab);
        if (!mountedRef.current) return;
        addToast({
          message:
            err instanceof Error ? err.message : `Could not load your ${tab.toLowerCase()}.`,
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => {
        if (mountedRef.current) patchCollection(tab, { loading: false });
      });
  }, [isAuthenticated, activeTab, patchCollection, addToast]);

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'Portfolio') return;

    let cancelled = false;
    setPortfolioLoading(true);

    Promise.allSettled([walletApi.getMe(), walletApi.transactions(null, 8)])
      .then(([walletResult, transactionResult]) => {
        if (cancelled) return;
        if (walletResult.status === 'fulfilled') setProfileWallet(walletResult.value);
        if (transactionResult.status === 'fulfilled') {
          setProfileTransactions(transactionResult.value.items);
        }
        if (walletResult.status === 'rejected' && transactionResult.status === 'rejected') {
          addToast({
            message: 'Could not load portfolio transparency.',
            type: 'error',
            duration: 4000,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setPortfolioLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, activeTab, addToast]);

  const loadMoreCollection = async (tab: CollectionTab) => {
    const { cursor } = collections[tab];
    if (!cursor) return;

    try {
      const page = await COLLECTION_FETCHERS[tab](cursor, PAGE_SIZE);
      setCollections((prev) => {
        const seen = new Set(prev[tab].items.map((p) => p.id));
        return {
          ...prev,
          [tab]: {
            ...prev[tab],
            items: [...prev[tab].items, ...page.items.filter((p) => !seen.has(p.id))],
            cursor: page.nextCursor,
          },
        };
      });
    } catch {
      addToast({
        message: `Could not load more ${tab.toLowerCase()}.`,
        type: 'error',
        duration: 4000,
      });
    }
  };

  /** The list the active tab is showing — also what the viewer scrolls through. */
  const activeItems = isCollectionTab(activeTab) ? collections[activeTab].items : posts;

  /**
   * A post edited inside the viewer (liked, saved, reposted) is written back to
   * whichever grids hold it, so closing the viewer doesn't reveal stale counts.
   */
  const syncPost = useCallback((updated: FeedPost) => {
    const merge = (list: FeedPost[]) =>
      list.map((p) => (p.id === updated.id ? { ...p, ...updated } : p));

    setPosts(merge);
    setCollections((prev) => ({
      Reposts: { ...prev.Reposts, items: merge(prev.Reposts.items) },
      Favorites: { ...prev.Favorites, items: merge(prev.Favorites.items) },
      Liked: { ...prev.Liked, items: merge(prev.Liked.items) },
    }));
  }, []);

  // Unsaving from the Favorites grid removes the card immediately.
  const handleRemoveFavorite = async (post: FeedPost) => {
    const snapshot = collections.Favorites.items;
    patchCollection('Favorites', { items: snapshot.filter((p) => p.id !== post.id) });

    try {
      await postsApi.toggleBookmark(post.id);
      addToast({ message: 'Removed from favorites.', type: 'success', duration: 2500 });
    } catch {
      patchCollection('Favorites', { items: snapshot });
      addToast({ message: 'Could not update favorites.', type: 'error', duration: 4000 });
    }
  };

  const handleTogglePin = async (post: FeedPost) => {
    const nextPinned = !post.pinned;

    if (nextPinned && pinnedCount >= MAX_PINNED_POSTS) {
      addToast({
        message: `You can pin at most ${MAX_PINNED_POSTS} posts. Unpin one first.`,
        type: 'error',
        duration: 4000,
      });
      return;
    }

    // Optimistic — reverted below if the server disagrees.
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, pinned: nextPinned } : p)));

    try {
      if (nextPinned) {
        await postsApi.pin(post.id);
      } else {
        await postsApi.unpin(post.id);
      }
      addToast({
        message: nextPinned ? 'Post pinned.' : 'Post unpinned.',
        type: 'success',
        duration: 2500,
      });
    } catch (err) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, pinned: post.pinned } : p)));
      addToast({
        message: err instanceof Error ? err.message : 'Could not update pin.',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleDeletePost = async (post: FeedPost) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;

    const snapshot = posts;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));

    try {
      await postsApi.remove(post.id);
      addToast({ message: 'Post deleted.', type: 'success', duration: 3000 });
    } catch (err) {
      setPosts(snapshot);
      addToast({
        message: err instanceof Error ? err.message : 'Could not delete post.',
        type: 'error',
        duration: 4000,
      });
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const profile = await usersApi.updateProfile({ bio: bioInput, websiteUrl: linkInput });
      updateUser(profile);
      setIsEditing(false);
      addToast({ message: 'Profile updated!', type: 'success', duration: 3000 });
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not update profile.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const profile = await usersApi.uploadAvatar(file);
      updateUser(profile);
      addToast({ message: 'Profile picture updated!', type: 'success', duration: 3000 });
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not upload picture.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    addToast({ message: 'Profile link copied!', type: 'info', duration: 2500 });
  };

  // This page is "your profile" — with no session there is no profile to show,
  // and every request it makes would 401. Prompt for sign-in instead of rendering
  // a shell full of empty state.
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
          <UserCircle size={26} className="text-muted-foreground" />
        </div>
        <p className="text-foreground font-semibold text-lg">Sign in to see your profile</p>
        <p className="text-muted-foreground text-sm mt-1 mb-5 max-w-sm">
          Your posts, reposts, favorites and liked videos all live here.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm
            brand-gradient hover:brightness-110 transition"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      {/* Profile header */}
      <div className="px-6 lg:px-10 pt-8 lg:pt-16 pb-0">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => user?.avatarUrl && setAvatarPreviewOpen(true)}
              disabled={!user?.avatarUrl}
              aria-label="View your profile picture"
              className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl font-bold text-white overflow-hidden ring-4 ring-border enabled:cursor-zoom-in enabled:hover:brightness-110 transition disabled:cursor-default"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </button>
            {avatarPreviewOpen && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setAvatarPreviewOpen(false);
                }}
                aria-label="Close profile picture preview"
                className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white shadow-lg hover:bg-black/90 transition"
              >
                <X size={14} />
              </button>
            )}
            {isEditing && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 w-8 h-8 brand-gradient rounded-full flex items-center justify-center shadow-lg hover:brightness-110 transition disabled:opacity-60"
                >
                  {uploadingAvatar ? (
                    <Loader2 size={14} className="text-white animate-spin" />
                  ) : (
                    <Camera size={14} className="text-white" />
                  )}
                </button>
              </>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-foreground">
                {user?.displayName ?? 'Your Name'}
              </h1>
              <span className="text-muted-foreground text-sm">
                @{user?.username ?? 'username'}
              </span>
            </div>

            {/* Stats */}
            <div className="flex gap-6 mb-4">
              {[
                { label: 'Following', value: String(user?.followingCount ?? 0), action: 'following' as const },
                { label: 'Followers', value: String(user?.followersCount ?? 0), action: 'followers' as const },
                { label: 'Likes', value: String(user?.likesCount ?? 0), action: null },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => s.action && setFollowModal({ tab: s.action })}
                  disabled={!s.action}
                  className={`text-center sm:text-left ${s.action ? 'hover:opacity-70 transition cursor-pointer' : ''}`}
                  type="button"
                >
                  <span className="font-bold text-foreground">{s.value}</span>{' '}
                  <span className="text-muted-foreground text-sm">{s.label}</span>
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
              <button
                onClick={() => {
                  setIsEditing(!isEditing);
                  setBioInput(bio);
                  setLinkInput(link);
                }}
                className="flex items-center gap-2 px-4 py-1.5 glass-chip text-foreground rounded-full text-sm font-medium hover:brightness-125 transition"
              >
                <Pencil size={13} />
                {isEditing ? 'Cancel' : 'Edit profile'}
              </button>
              <button
                onClick={handleShare}
                className="w-8 h-8 flex items-center justify-center rounded-full glass-chip hover:brightness-125 transition"
              >
                <Share2 size={14} className="text-foreground" />
              </button>
              <NextLink
                href="/app/groups?create=1"
                title="Create a group"
                className="w-8 h-8 flex items-center justify-center rounded-full glass-chip hover:brightness-125 transition"
              >
                <UsersRound size={14} className="text-foreground" />
              </NextLink>

              {/* More actions */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  onClick={() => setMoreMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={moreMenuOpen}
                  aria-label="More actions"
                  className="w-8 h-8 flex items-center justify-center rounded-full glass-chip hover:brightness-125 transition"
                >
                  <ChevronDown
                    size={14}
                    className={`text-foreground transition-transform ${moreMenuOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {moreMenuOpen && (
                  <div
                    role="menu"
                    className="absolute left-0 top-10 z-50 w-48 glass-card rounded-xl shadow-2xl py-1"
                  >
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMoreMenuOpen(false);
                        addToast({
                          message: 'Post boosting is coming soon.',
                          type: 'info',
                          duration: 3000,
                        });
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-sidebar-accent transition text-left"
                    >
                      <Rocket size={15} className="text-muted-foreground" />
                      Boost post
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bio */}
            {isEditing ? (
              <div className="space-y-2 max-w-lg">
                <textarea
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  rows={3}
                  placeholder="Write a bio..."
                  className="w-full px-3 py-2 glass-input rounded-xl text-sm text-foreground placeholder-muted-foreground resize-none"
                />
                <input
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  placeholder="https://yourlink.com"
                  className="w-full px-3 py-2 glass-input rounded-xl text-sm text-foreground placeholder-muted-foreground"
                />
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white text-sm
                    brand-gradient
                    brand-glow
                    hover:brightness-110 transition disabled:opacity-70"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            ) : (
              // Only the owner reaches this page, so an empty field is always
              // something they can fill — prompt for it by name instead of
              // rendering nothing and leaving them to guess.
              <div className="space-y-1.5">
                {bio ? (
                  <p className="text-sm text-foreground whitespace-pre-line max-w-lg">{bio}</p>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Pencil size={12} />
                    Tell us about you
                  </button>
                )}
                {link ? (
                  <a
                    href={externalHref(link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Link2 size={13} />
                    {displayUrl(link)}
                  </a>
                ) : (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Link2 size={12} />
                    Add a link
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        <div className="mt-6" />

        {/* Tabs */}
        <div className="flex items-center mt-0">
          <div className="flex">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'Posts' && <LayoutGrid size={14} />}
                {tab === 'Portfolio' && <Wallet size={14} />}
                {tab === 'Reposts' && <Repeat2 size={14} />}
                {tab === 'Favorites' && <Bookmark size={14} />}
                {tab === 'Liked' && <Heart size={14} />}
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="px-6 lg:px-10 pt-4">
        {activeTab === 'Posts' ? (
          postsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-lg aspect-[9/16] bg-white/[0.06] animate-pulse"
                />
              ))}
            </div>
          ) : postsError ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-foreground font-semibold">Could not load your posts</p>
              <p className="text-muted-foreground text-sm mt-1">{postsError}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
                <LayoutGrid size={24} className="text-muted-foreground" />
              </div>
              <p className="text-foreground font-semibold">No posts yet</p>
              <p className="text-muted-foreground text-sm mt-1 mb-4">
                Share text, a photo or a video to get started.
              </p>
              <NextLink
                href="/app/upload"
                className="px-5 py-2 rounded-xl font-semibold text-white text-sm
                  brand-gradient hover:brightness-110 transition"
              >
                Create your first post
              </NextLink>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {posts.map((p, i) => (
                  <PostGridCard
                    key={p.id}
                    post={p}
                    index={i}
                    onOpen={() => setViewer({ tab: 'Posts', index: i })}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDeletePost}
                  />
                ))}
              </div>

              {/* Infinite scroll sentinel */}
              <div ref={sentinelRef} className="h-10" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              )}
              {!nextCursor && posts.length > PAGE_SIZE && (
                <p className="text-center text-muted-foreground text-xs py-4">
                  You&apos;ve reached the end.
                </p>
              )}
            </>
          )
        ) : activeTab === 'Portfolio' ? (
          <ProfilePortfolioTransparency
            wallet={profileWallet}
            transactions={profileTransactions}
            loading={portfolioLoading}
          />
        ) : isCollectionTab(activeTab) ? (
          (() => {
            const { items, cursor, loading, loaded } = collections[activeTab];
            const copy = COLLECTION_EMPTY_COPY[activeTab];
            const EmptyIcon =
              activeTab === 'Reposts' ? Repeat2 : activeTab === 'Favorites' ? Bookmark : Heart;

            if (loading && !loaded) {
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-lg aspect-[9/16] bg-white/[0.06] animate-pulse"
                    />
                  ))}
                </div>
              );
            }

            if (items.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
                    <EmptyIcon size={24} className="text-muted-foreground" />
                  </div>
                  <p className="text-foreground font-semibold">{copy.title}</p>
                  <p className="text-muted-foreground text-sm mt-1">{copy.body}</p>
                </div>
              );
            }

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {items.map((p, i) => (
                    <PostGridCard
                      key={p.id}
                      post={p}
                      index={i}
                      variant={activeTab === 'Favorites' ? 'favorite' : undefined}
                      onOpen={() => setViewer({ tab: activeTab, index: i })}
                      onRemoveFavorite={
                        activeTab === 'Favorites' ? handleRemoveFavorite : undefined
                      }
                    />
                  ))}
                </div>

                {cursor && (
                  <button
                    onClick={() => loadMoreCollection(activeTab)}
                    className="w-full text-center text-primary text-sm font-medium py-4 hover:underline"
                  >
                    Load more
                  </button>
                )}
              </>
            );
          })()
        ) : null}
      </div>

      {/*
        Tapping a card opens the feed over the profile, scoped to the tab you were
        on — scrolling moves to your next post in that collection, never into the
        public feed. Seeded with the posts already loaded, so it opens instantly.
      */}
      {viewer && activeItems.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black">
          <ImmersiveFeed
            title={viewer.tab}
            initialPosts={activeItems}
            initialCursor={
              isCollectionTab(viewer.tab) ? collections[viewer.tab].cursor : nextCursor
            }
            initialIndex={viewer.index}
            fetchPage={(cursor) =>
              isCollectionTab(viewer.tab)
                ? COLLECTION_FETCHERS[viewer.tab](cursor, PAGE_SIZE)
                : postsApi.byUsername(username ?? '', cursor, PAGE_SIZE)
            }
            onClose={() => setViewer(null)}
            onPostChanged={syncPost}
          />
        </div>
      )}

      {followModal && user && (
        <FollowersFollowingModal
          username={user.username}
          initialTab={followModal.tab}
          onClose={() => setFollowModal(null)}
        />
      )}

      {avatarPreviewOpen && user?.avatarUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Your profile picture"
          onClick={() => setAvatarPreviewOpen(false)}
        >
          <div
            className="relative h-[min(72vw,28rem)] w-[min(72vw,28rem)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="h-full w-full overflow-hidden rounded-full bg-background ring-4 ring-white/20 shadow-2xl">
              <img src={user.avatarUrl} alt="Your profile picture" className="h-full w-full object-cover" />
            </div>
            {/* Sits outside the circular clip mask so it doesn't get cut off. */}
            <button
              type="button"
              onClick={() => setAvatarPreviewOpen(false)}
              aria-label="Close profile picture"
              className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Deterministic per card position — Math.random() here would re-roll on every
// render and mismatch between server and client HTML.
const CARD_GRADIENTS = [
  'from-[#3B0B57] to-[#1A1424]',
  'from-[#5B1B6B] to-[#2A1B36]',
  'from-[#8E1030] to-[#1A1424]',
  'from-[#C4143F] to-[#3B0B57]',
  'from-[#2A1B36] to-[#12101A]',
];

function ProfilePortfolioTransparency({
  wallet,
  transactions,
  loading,
}: {
  wallet: WalletOverview | null;
  transactions: WalletTransaction[];
  loading: boolean;
}) {
  const holdings = wallet?.holdings ?? [];
  const balanceNaira = Number(wallet?.pointsBalance ?? 0);
  const balanceCoins = nairaToSignalFaceCoins(balanceNaira);
  const change = wallet?.change24h ?? 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl h-36 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Portfolio Value</p>
          <p className="mt-2 text-xl font-bold text-foreground">
            {naira(wallet?.totalValue ?? 0)}
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">24-hour Change</p>
          <p className={`mt-2 text-xl font-bold ${change >= 0 ? 'text-up' : 'text-down'}`}>
            {change >= 0 ? '+' : ''}
            {change.toFixed(2)}%
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Holdings</p>
          <p className="mt-2 text-xl font-bold text-foreground">{holdings.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Available to Trade</p>
          <p className="mt-2 text-xl font-bold text-foreground">
            {formatSignalFaceCoins(balanceCoins)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{naira(balanceNaira)} equivalent</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="font-bold text-foreground">Holdings Transparency</h2>
          </div>
          {holdings.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No holdings yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {holdings.map((holding) => (
                <li key={holding.signalId} className="p-4 flex items-center justify-between gap-4">
                  <NextLink href={`/app/u/${holding.creatorUsername}`} className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {holding.creatorName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      @{holding.creatorUsername} ·{' '}
                      {Number(holding.quantity).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })}{' '}
                      shares
                    </p>
                  </NextLink>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-foreground">
                      {naira(holding.currentValue)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Avg {naira(holding.avgBuyPrice)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10">
            <h2 className="font-bold text-foreground">Transaction History</h2>
          </div>
          {transactions.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <ul className="divide-y divide-white/10">
              {transactions.map((transaction) => (
                <li key={transaction.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {PROFILE_TXN_LABELS[transaction.type]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {transaction.note ?? compactDate(transaction.createdAt)}
                    </p>
                  </div>
                  <p
                    className={`text-sm font-bold flex-shrink-0 ${
                      Number(transaction.amount) >= 0 ? 'text-up' : 'text-down'
                    }`}
                  >
                    {formatNaira(transaction.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <NextLink
        href="/app/portfolio"
        className="inline-flex items-center justify-center rounded-xl brand-gradient px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition"
      >
        Open portfolio dashboard
      </NextLink>
    </div>
  );
}

function PostGridCard({
  post,
  index,
  variant = 'own',
  onOpen,
  onTogglePin,
  onDelete,
  onRemoveFavorite,
}: {
  post: FeedPost;
  index: number;
  // 'own' shows pin/delete; 'favorite' shows the author and an unsave button,
  // since saved posts usually belong to someone else.
  variant?: 'own' | 'favorite';
  onOpen?: () => void;
  onTogglePin?: (post: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
  onRemoveFavorite?: (post: FeedPost) => void;
}) {
  const { kind, pinned, viewCount, body, mediaUrls, media } = post;
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const preview = mediaUrls[0];
  // More than one item earns the stacked-media marker, as on Instagram.
  const itemCount = media?.length ?? mediaUrls.length;

  return (
    <div
      onClick={onOpen}
      // A card is an activatable thing, so give it the keyboard and semantics of
      // one — it opens the viewer, and Enter/Space have to do the same.
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onKeyDown={
        onOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpen();
              }
            }
          : undefined
      }
      className="relative group cursor-pointer rounded-lg overflow-hidden aspect-[9/16] bg-gradient-to-br from-[#1A1424] to-[#12101A] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {/* Media, or a gradient card carrying the text */}
      {kind === 'image' && preview ? (
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : kind === 'video' && post.coverUrl ? (
        // The author picked this frame, so it beats whatever the decoder would
        // land on — and an <img> costs far less than a <video> per grid cell.
        <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : kind === 'video' && preview ? (
        <video
          src={preview}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        <>
          <div className={`absolute inset-0 bg-gradient-to-br ${grad} opacity-60`} />
          <div className="absolute inset-0 flex items-center justify-center p-3">
            <p className="text-white text-xs font-semibold text-center leading-tight line-clamp-6 drop-shadow">
              {body}
            </p>
          </div>
        </>
      )}


      {/* Pinned badge — only when actually pinned, and only on your own grid */}
      {pinned && variant === 'own' && (
        <div className="absolute top-2 left-2 brand-gradient text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Pinned
        </div>
      )}

      {/* Post kind, and the item count when the post carries more than one */}
      <div className="absolute top-2 right-2 flex items-center gap-1 text-white/80 drop-shadow">
        {itemCount > 1 && (
          <span className="text-[10px] font-bold leading-none">{itemCount}</span>
        )}
        {kind === 'video' && <Play size={12} fill="currentColor" />}
        {kind === 'image' && <ImageIcon size={12} />}
        {kind === 'text' && <FileText size={12} />}
      </div>

      {/* Reach — video counts plays, everything else counts views */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs drop-shadow">
        {kind === 'video' ? <Play size={10} fill="white" /> : <Eye size={10} />}
        <span>{viewCount.toLocaleString()}</span>
      </div>

      {/* Author credit — saved posts are usually someone else's */}
      {variant === 'favorite' && (
        <div className="absolute bottom-2 right-2 max-w-[70%] text-white/90 text-[10px] font-medium truncate drop-shadow">
          @{post.author.username}
        </div>
      )}

      {/* Hover overlay + controls */}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />

      {variant === 'own' && post.isMine && (
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* These sit inside the card, which now opens the viewer — without
              stopping the click, pinning would also open the post. */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onTogglePin?.(post); }}
            title={pinned ? 'Unpin' : 'Pin to top'}
            className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
          >
            {pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete?.(post); }}
            title="Delete post"
            className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-red-600"
          >
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {variant === 'favorite' && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemoveFavorite?.(post); }}
          title="Remove from favorites"
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <BookmarkX size={12} />
        </button>
      )}
    </div>
  );
}
