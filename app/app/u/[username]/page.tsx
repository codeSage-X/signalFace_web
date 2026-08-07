'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Link2, Play, Eye, FileText, Image as ImageIcon,
  Loader2, ArrowLeft, UserPlus, UserCheck, LayoutGrid,
} from 'lucide-react';
import { postsApi, usersApi, type FeedPost, type PublicProfile } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { useRequireAuth } from '@/hooks/useRequireAuth';

const PAGE_SIZE = 12;

const CARD_GRADIENTS = [
  'from-[#3B0B57] to-[#1A1424]',
  'from-[#5B1B6B] to-[#2A1B36]',
  'from-[#8E1030] to-[#1A1424]',
  'from-[#C4143F] to-[#3B0B57]',
  'from-[#2A1B36] to-[#12101A]',
];

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = (params?.username ?? '') as string;
  const router = useRouter();
  const { user } = useAuth();
  const { addToast } = useToast();
  const { requireAuth } = useRequireAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  // Your own profile lives at /app/profile, which has the editing controls.
  useEffect(() => {
    if (user?.username && username && user.username === username.toLowerCase()) {
      router.replace('/app/profile');
    }
  }, [user?.username, username, router]);

  useEffect(() => {
    if (!username) return;

    let cancelled = false;
    setProfileLoading(true);
    setProfileError(null);

    usersApi
      .getPublicProfile(username)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch((err) => {
        if (!cancelled) setProfileError(err instanceof Error ? err.message : 'Profile not found.');
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!username) return;

    let cancelled = false;
    setPostsLoading(true);

    postsApi
      .byUsername(username, null, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await postsApi.byUsername(username, nextCursor, PAGE_SIZE);
      setPosts((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more posts.', type: 'error', duration: 4000 });
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [username, nextCursor, addToast]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !nextCursor) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) loadMore();
      },
      { rootMargin: '400px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextCursor, loadMore]);

  const handleFollow = () => {
    if (!profile) return;

    requireAuth(async () => {
      setFollowPending(true);
      const next = !profile.isFollowedByMe;

      // Optimistic on both the button and the follower tally.
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowedByMe: next,
              followersCount: prev.followersCount + (next ? 1 : -1),
            }
          : prev,
      );

      try {
        const res = await usersApi.toggleFollow(profile.username);
        setProfile((prev) =>
          prev
            ? { ...prev, isFollowedByMe: res.following, followersCount: res.followersCount }
            : prev,
        );
      } catch (err) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                isFollowedByMe: !next,
                followersCount: prev.followersCount + (next ? -1 : 1),
              }
            : prev,
        );
        addToast({
          message: err instanceof Error ? err.message : 'Could not update follow.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setFollowPending(false);
      }
    });
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={26} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (profileError || !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center px-6">
        <p className="text-foreground font-semibold text-lg">Profile not found</p>
        <p className="text-muted-foreground text-sm mt-1 mb-5">
          @{username} doesn&apos;t exist or is no longer available.
        </p>
        <Link
          href="/app/for-you"
          className="px-5 py-2 rounded-xl font-semibold text-white text-sm
            brand-gradient hover:brightness-110 transition"
        >
          Back to the feed
        </Link>
      </div>
    );
  }

  const initials = profile.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <div className="pb-10">
      <div className="px-6 lg:px-10 pt-6 lg:pt-16 pb-0">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-5 transition"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-3xl font-bold text-white overflow-hidden ring-4 ring-border flex-shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-foreground">{profile.displayName}</h1>
              <span className="text-muted-foreground text-sm">@{profile.username}</span>
              {profile.creatorStatus === 'APPROVED' && (
                <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-semibold">
                  Creator
                </span>
              )}
            </div>

            <div className="flex gap-6 mb-4">
              {[
                { label: 'Posts', value: profile.postsCount },
                { label: 'Following', value: profile.followingCount },
                { label: 'Followers', value: profile.followersCount },
                { label: 'Likes', value: profile.likesCount },
              ].map((s) => (
                <div key={s.label} className="text-center sm:text-left">
                  <span className="font-bold text-foreground">{s.value.toLocaleString()}</span>{' '}
                  <span className="text-muted-foreground text-sm">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap mb-4">
              <button
                onClick={handleFollow}
                disabled={followPending}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition disabled:opacity-70 ${
                  profile.isFollowedByMe
                    ? 'glass-chip text-foreground hover:brightness-125'
                    : 'text-white brand-gradient brand-glow hover:brightness-110'
                }`}
              >
                {followPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : profile.isFollowedByMe ? (
                  <UserCheck size={14} />
                ) : (
                  <UserPlus size={14} />
                )}
                {profile.isFollowedByMe ? 'Following' : 'Follow'}
              </button>
            </div>

            {profile.bio && (
              <p className="text-sm text-foreground whitespace-pre-line max-w-lg">{profile.bio}</p>
            )}
            {profile.websiteUrl && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline mt-1"
              >
                <Link2 size={13} />
                {profile.websiteUrl.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>
        </div>

        <div className="mt-6" />
      </div>

      {/* Posts grid */}
      <div className="px-6 lg:px-10 pt-4">
        {postsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-lg aspect-[9/16] bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
              <LayoutGrid size={24} className="text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold">No posts yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              @{profile.username} hasn&apos;t posted anything.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {posts.map((p, i) => (
                <ProfilePostCard key={p.id} post={p} index={i} />
              ))}
            </div>

            <div ref={sentinelRef} className="h-10" />
            {loadingMore && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ProfilePostCard({ post, index }: { post: FeedPost; index: number }) {
  const { kind, pinned, viewCount, body, mediaUrls } = post;
  const grad = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const preview = mediaUrls[0];

  return (
    <div className="relative group cursor-pointer rounded-lg overflow-hidden aspect-[9/16] bg-gradient-to-br from-[#1A1424] to-[#12101A]">
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

      {pinned && (
        <div className="absolute top-2 left-2 brand-gradient text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
          Pinned
        </div>
      )}

      <div className="absolute top-2 right-2 text-white/80 drop-shadow">
        {kind === 'video' && <Play size={12} fill="currentColor" />}
        {kind === 'image' && <ImageIcon size={12} />}
        {kind === 'text' && <FileText size={12} />}
      </div>

      <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs drop-shadow">
        {kind === 'video' ? <Play size={10} fill="white" /> : <Eye size={10} />}
        <span>{viewCount.toLocaleString()}</span>
      </div>

      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
