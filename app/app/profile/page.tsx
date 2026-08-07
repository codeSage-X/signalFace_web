'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { useAuth } from '@/lib/stores';
import { useToast } from '@/lib/stores';
import { usersApi, postsApi, ApiError, type FeedPost } from '@/lib/api';
import { CreatorMenuSection } from '@/components/creator/CreatorMenuSection';
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
  LayoutDashboard,
  LayoutGrid,
  FileText,
  Eye,
  Image as ImageIcon,
  Pin,
  PinOff,
  Trash2,
  BookmarkX,
} from 'lucide-react';

const MAX_PINNED_POSTS = 3;
const PAGE_SIZE = 12;
const TABS = ['Posts', 'Reposts', 'Favorites', 'Liked'] as const;
const SORTS = ['Latest', 'Popular', 'Oldest'] as const;

type Tab = (typeof TABS)[number];
type Sort = (typeof SORTS)[number];

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('Posts');
  const [activeSort, setActiveSort] = useState<Sort>('Latest');
  const [isEditing, setIsEditing] = useState(false);
  const [bioInput, setBioInput] = useState(user?.bio ?? '');
  const [linkInput, setLinkInput] = useState(user?.websiteUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Posts grid
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Favorites (bookmarks) grid — loaded lazily the first time the tab opens.
  const [favorites, setFavorites] = useState<FeedPost[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoritesCursor, setFavoritesCursor] = useState<string | null>(null);
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
    usersApi
      .getMe()
      .then((profile) => updateUser(profile))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Favorites are only fetched once the tab is actually opened.
  useEffect(() => {
    if (activeTab !== 'Favorites' || favoritesLoaded) return;

    let cancelled = false;
    setFavoritesLoading(true);

    postsApi
      .bookmarks(null, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setFavorites(page.items);
        setFavoritesCursor(page.nextCursor);
        setFavoritesLoaded(true);
      })
      .catch((err) => {
        if (cancelled) return;
        addToast({
          message: err instanceof Error ? err.message : 'Could not load your favorites.',
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) setFavoritesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, favoritesLoaded, addToast]);

  const loadMoreFavorites = async () => {
    if (!favoritesCursor) return;
    try {
      const page = await postsApi.bookmarks(favoritesCursor, PAGE_SIZE);
      setFavorites((prev) => [...prev, ...page.items]);
      setFavoritesCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more favorites.', type: 'error', duration: 4000 });
    }
  };

  // Unsaving from the Favorites grid removes the card immediately.
  const handleRemoveFavorite = async (post: FeedPost) => {
    const snapshot = favorites;
    setFavorites((prev) => prev.filter((p) => p.id !== post.id));

    try {
      await postsApi.toggleBookmark(post.id);
      addToast({ message: 'Removed from favorites.', type: 'success', duration: 2500 });
    } catch {
      setFavorites(snapshot);
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

  return (
    <div className="min-h-screen pb-12">
      {/* Profile header */}
      <div className="px-6 lg:px-10 pt-8 lg:pt-16 pb-0">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl font-bold text-white overflow-hidden ring-4 ring-border">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
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
                { label: 'Following', value: String(user?.followingCount ?? 0) },
                { label: 'Followers', value: String(user?.followersCount ?? 0) },
                { label: 'Likes', value: String(user?.likesCount ?? 0) },
              ].map((s) => (
                <div key={s.label} className="text-center sm:text-left">
                  <span className="font-bold text-foreground">{s.value}</span>{' '}
                  <span className="text-muted-foreground text-sm">{s.label}</span>
                </div>
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
                    <NextLink
                      role="menuitem"
                      href="/app/dashboard"
                      onClick={() => setMoreMenuOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-sidebar-accent transition text-left"
                    >
                      <LayoutDashboard size={15} className="text-muted-foreground" />
                      Dashboard
                    </NextLink>
                    <CreatorMenuSection onDismiss={() => setMoreMenuOpen(false)} />
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
              <div className="space-y-1">
                {bio && (
                  <p className="text-sm text-foreground whitespace-pre-line max-w-lg">{bio}</p>
                )}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Link2 size={13} />
                    {link.replace(/^https?:\/\//, '')}
                  </a>
                )}
                {!bio && !isEditing && (
                  <p className="text-sm text-muted-foreground italic">
                    No bio yet.{' '}
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-primary hover:underline not-italic"
                    >
                      Add one
                    </button>
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

        <div className="mt-6" />

        {/* Tabs */}
        <div className="flex items-center justify-between mt-0">
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
                {tab === 'Reposts' && <Repeat2 size={14} />}
                {tab === 'Favorites' && <Bookmark size={14} />}
                {tab === 'Liked' && <Heart size={14} />}
                {tab}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-1">
            {SORTS.map((s) => (
              <button
                key={s}
                onClick={() => setActiveSort(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  activeSort === s
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:bg-sidebar-accent'
                }`}
              >
                {s}
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
        ) : activeTab === 'Favorites' ? (
          favoritesLoading && !favoritesLoaded ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-lg aspect-[9/16] bg-white/[0.06] animate-pulse" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
                <Bookmark size={24} className="text-muted-foreground" />
              </div>
              <p className="text-foreground font-semibold">No favorites yet</p>
              <p className="text-muted-foreground text-sm mt-1">
                Tap the bookmark icon on any post to save it here.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {favorites.map((p, i) => (
                  <PostGridCard
                    key={p.id}
                    post={p}
                    index={i}
                    variant="favorite"
                    onRemoveFavorite={handleRemoveFavorite}
                  />
                ))}
              </div>

              {favoritesCursor && (
                <button
                  onClick={loadMoreFavorites}
                  className="w-full text-center text-primary text-sm font-medium py-4 hover:underline"
                >
                  Load more
                </button>
              )}
            </>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
              {activeTab === 'Reposts' && <Repeat2 size={24} className="text-muted-foreground" />}
              {activeTab === 'Liked' && <Heart size={24} className="text-muted-foreground" />}
            </div>
            <p className="text-foreground font-semibold">No {activeTab.toLowerCase()} yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Content you {activeTab.toLowerCase()} will appear here
            </p>
          </div>
        )}
      </div>
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

function PostGridCard({
  post,
  index,
  variant = 'own',
  onTogglePin,
  onDelete,
  onRemoveFavorite,
}: {
  post: FeedPost;
  index: number;
  // 'own' shows pin/delete; 'favorite' shows the author and an unsave button,
  // since saved posts usually belong to someone else.
  variant?: 'own' | 'favorite';
  onTogglePin?: (post: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
  onRemoveFavorite?: (post: FeedPost) => void;
}) {
  const { kind, pinned, viewCount, body, mediaUrls } = post;
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const preview = mediaUrls[0];

  return (
    <div className="relative group cursor-pointer rounded-lg overflow-hidden aspect-[9/16] bg-gradient-to-br from-[#1A1424] to-[#12101A]">
      {/* Media, or a gradient card carrying the text */}
      {kind === 'image' && preview ? (
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
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

      {/* Post kind */}
      <div className="absolute top-2 right-2 text-white/80 drop-shadow">
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
          <button
            type="button"
            onClick={() => onTogglePin?.(post)}
            title={pinned ? 'Unpin' : 'Pin to top'}
            className="w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
          >
            {pinned ? <PinOff size={12} /> : <Pin size={12} />}
          </button>
          <button
            type="button"
            onClick={() => onDelete?.(post)}
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
          onClick={() => onRemoveFavorite?.(post)}
          title="Remove from favorites"
          className="absolute top-2 left-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <BookmarkX size={12} />
        </button>
      )}
    </div>
  );
}
