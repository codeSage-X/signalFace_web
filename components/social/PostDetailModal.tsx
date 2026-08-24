'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Heart,
  Loader2,
  MessageCircle,
  Play,
  Repeat2,
  Send,
  Share2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  postsApi,
  usersApi,
  type FeedPost,
  type PostComment,
  type PostMediaItem,
} from '@/lib/api';
import { useAuth, useToast, useVideoSound } from '@/lib/stores';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const COMMENTS_PAGE = 12;

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

/**
 * One media item. Video only autoplays while this modal is the thing on screen,
 * and honours the app-wide sound preference so opening a post doesn't blare.
 */
function Media({ item, active }: { item: PostMediaItem; active: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const muted = useVideoSound((s) => s.muted);
  const toggleMuted = useVideoSound((s) => s.toggleMuted);

  useEffect(() => {
    if (!ref.current) return;
    if (active) {
      ref.current.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      ref.current.pause();
      setPlaying(false);
    }
  }, [active]);

  if (item.kind !== 'video') {
    return (
      <img
        src={item.url}
        alt=""
        className="max-w-full max-h-full object-contain"
        draggable={false}
      />
    );
  }

  const togglePlay = () => {
    if (!ref.current) return;
    if (playing) {
      ref.current.pause();
      setPlaying(false);
    } else {
      ref.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center" onClick={togglePlay}>
      <video
        ref={ref}
        src={item.url}
        className="max-w-full max-h-full object-contain cursor-pointer"
        loop
        muted={muted}
        playsInline
        preload="metadata"
      />

      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="w-16 h-16 rounded-full bg-black/45 backdrop-blur-sm flex items-center justify-center">
            <Play size={26} fill="white" className="text-white ml-1" />
          </span>
        </div>
      )}

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleMuted();
        }}
        aria-label={muted ? 'Unmute' : 'Mute'}
        className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition"
      >
        {muted ? (
          <VolumeX size={16} className="text-white" />
        ) : (
          <Volume2 size={16} className="text-white" />
        )}
      </button>
    </div>
  );
}

/**
 * A post opened from a grid: media on one side, the creator and the conversation
 * on the other.
 *
 * Deliberately not the vertical feed. Tapping a thumbnail on Explore used to
 * navigate to the public feed, which lost the viewer's place and played
 * something else entirely — this keeps them where they were and closes back to
 * the same grid.
 */
export function PostDetailModal({
  posts,
  index,
  onIndexChange,
  onClose,
  onChanged,
}: {
  /** The grid the viewer opened from, so they can move through it in place. */
  posts: FeedPost[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  /** Lets the grid behind stay in step with likes, saves and reposts. */
  onChanged?: (post: FeedPost) => void;
}) {
  const current = posts[index];

  // A local copy so likes and comments can update optimistically. Re-seeded
  // whenever the viewer moves to a different post.
  const [post, setPost] = useState<FeedPost>(current);
  const [mediaIndex, setMediaIndex] = useState(0);

  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsCursor, setCommentsCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [followPending, setFollowPending] = useState(false);

  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  const hasPrev = index > 0;
  const hasNext = index < posts.length - 1;

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next > posts.length - 1) return;
      onIndexChange(next);
    },
    [posts.length, onIndexChange],
  );

  // Moving to another post resets everything that belonged to the old one.
  //
  // Keyed on the id, not the object: the parent rebuilds its array on every
  // like, which hands us a fresh `current` reference for the same post. Keyed on
  // the reference, liking would wipe a half-typed comment and snap a carousel
  // back to its first image.
  useEffect(() => {
    setPost(current);
    setMediaIndex(0);
    setDraft('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  const items: PostMediaItem[] = post.media?.length
    ? post.media
    : post.mediaUrls.map((url) => ({
        url,
        kind: post.kind === 'video' ? 'video' : 'image',
      }));

  const update = useCallback(
    (patch: Partial<FeedPost>) => {
      setPost((prev) => {
        const next = { ...prev, ...patch };
        onChanged?.(next);
        return next;
      });
    },
    [onChanged],
  );

  // Escape closes; the arrows move through the grid. Bound to the window so it
  // works without the dialog holding focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Never hijack the arrows while the viewer is typing a comment.
      const typing =
        e.target instanceof HTMLElement &&
        (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');

      if (e.key === 'Escape') onClose();
      if (typing) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        goTo(index + 1);
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        goTo(index - 1);
      }
    };
    window.addEventListener('keydown', onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose, goTo, index]);

  // Counted once per post viewed, best effort — a failed view must not break
  // playback.
  useEffect(() => {
    postsApi.registerView(current.id).catch(() => {});
  }, [current.id]);

  useEffect(() => {
    let cancelled = false;
    setCommentsLoading(true);

    postsApi
      .comments(current.id, null, COMMENTS_PAGE)
      .then((page) => {
        if (cancelled) return;
        setComments(page.items);
        setCommentsCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [current.id]);

  const loadMoreComments = async () => {
    if (!commentsCursor) return;
    try {
      const page = await postsApi.comments(current.id, commentsCursor, COMMENTS_PAGE);
      setComments((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        return [...prev, ...page.items.filter((c) => !seen.has(c.id))];
      });
      setCommentsCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more comments.', type: 'error', duration: 4000 });
    }
  };

  const handleLike = () =>
    requireAuth(async () => {
      const snapshot = { likedByMe: post.likedByMe, likeCount: post.likeCount };
      update({
        likedByMe: !post.likedByMe,
        likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
      });

      try {
        const res = await postsApi.toggleLike(post.id);
        update({ likedByMe: res.liked, likeCount: res.likeCount });
      } catch {
        update(snapshot);
        addToast({ message: 'Could not register your like.', type: 'error', duration: 4000 });
      }
    });

  const handleBookmark = () =>
    requireAuth(async () => {
      const snapshot = {
        bookmarkedByMe: post.bookmarkedByMe,
        bookmarkCount: post.bookmarkCount,
      };
      update({
        bookmarkedByMe: !post.bookmarkedByMe,
        bookmarkCount: post.bookmarkCount + (post.bookmarkedByMe ? -1 : 1),
      });

      try {
        const res = await postsApi.toggleBookmark(post.id);
        update({ bookmarkedByMe: res.bookmarked, bookmarkCount: res.bookmarkCount });
      } catch {
        update(snapshot);
        addToast({ message: 'Could not save this post.', type: 'error', duration: 4000 });
      }
    });

  const handleRepost = () =>
    requireAuth(async () => {
      const snapshot = { repostedByMe: post.repostedByMe, repostCount: post.repostCount };
      update({
        repostedByMe: !post.repostedByMe,
        repostCount: (post.repostCount ?? 0) + (post.repostedByMe ? -1 : 1),
      });

      try {
        const res = await postsApi.toggleRepost(post.id);
        update({ repostedByMe: res.reposted, repostCount: res.repostCount });
      } catch {
        update(snapshot);
        addToast({ message: 'Could not repost this.', type: 'error', duration: 4000 });
      }
    });

  const handleFollow = () =>
    requireAuth(async () => {
      if (followPending) return;
      setFollowPending(true);
      const next = !post.author.followedByMe;
      update({ author: { ...post.author, followedByMe: next } });

      try {
        const res = await usersApi.toggleFollow(post.author.username);
        update({ author: { ...post.author, followedByMe: res.following } });
      } catch {
        update({ author: { ...post.author, followedByMe: !next } });
        addToast({ message: 'Could not update follow.', type: 'error', duration: 4000 });
      } finally {
        setFollowPending(false);
      }
    });

  const handleShare = async () => {
    const url = `${window.location.origin}/app/for-you?post=${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${post.author.username} on Signal Face`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      addToast({ message: 'Link copied to clipboard.', type: 'success', duration: 3000 });
    } catch {
      // Share sheet dismissed — nothing to report.
    }
  };

  const submitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    requireAuth(async () => {
      setSending(true);
      try {
        const comment = await postsApi.addComment(post.id, body);
        // Newest first, matching the order the list is fetched in.
        setComments((prev) => [comment, ...prev]);
        update({ commentCount: post.commentCount + 1 });
        setDraft('');
      } catch (err) {
        addToast({
          message: err instanceof Error ? err.message : 'Could not post your comment.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setSending(false);
      }
    });
  };

  // One post per gesture: a trackpad emits a burst of wheel events, and without
  // a cooldown a single flick would skip several posts.
  const wheelLockRef = useRef(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) < 12 || wheelLockRef.current) return;

    wheelLockRef.current = true;
    setTimeout(() => {
      wheelLockRef.current = false;
    }, 420);

    goTo(index + (e.deltaY > 0 ? 1 : -1));
  };

  // Vertical swipe on touch, matching the direction of the wheel.
  const touchStartRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (start === null) return;

    const delta = start - (e.changedTouches[0]?.clientY ?? start);
    // Generous threshold so a tap-to-pause is never read as a swipe.
    if (Math.abs(delta) < 60) return;
    goTo(index + (delta > 0 ? 1 : -1));
  };

  const realm = post.realm;
  const authorHref = realm ? `/app/r/${realm.slug}` : `/app/u/${post.author.username}`;
  const authorName = realm ? realm.name : post.author.displayName;
  const authorHandle = realm ? realm.slug : post.author.username;
  const authorImage = realm ? realm.iconUrl : post.author.avatarUrl;

  return (
    <div className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex items-center justify-center p-0 sm:p-4">
      {/* Close. Outside the panel on desktop, over the media on mobile. */}
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed top-3 right-3 sm:top-5 sm:right-5 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition"
      >
        <X size={20} />
      </button>

      {/* Previous / next through the grid. Outside the panel on desktop so they
          never sit over the media; pinned to the edge on smaller screens. */}
      {posts.length > 1 && (
        <>
          <button
            onClick={() => goTo(index - 1)}
            disabled={!hasPrev}
            aria-label="Previous post"
            className="fixed left-2 sm:left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronUp size={20} />
          </button>
          <button
            onClick={() => goTo(index + 1)}
            disabled={!hasNext}
            aria-label="Next post"
            className="fixed left-2 sm:left-5 top-1/2 translate-y-8 z-10 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition disabled:opacity-25 disabled:cursor-not-allowed"
          >
            <ChevronDown size={20} />
          </button>

          <span className="fixed top-3 left-1/2 -translate-x-1/2 sm:top-5 z-10 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-[11px] font-semibold tabular-nums">
            {index + 1} of {posts.length}
          </span>
        </>
      )}

      <div className="w-full h-full sm:h-[88vh] sm:max-w-6xl bg-[#121013] sm:rounded-2xl overflow-hidden ring-1 ring-white/10 flex flex-col lg:flex-row">
        {/* Media. Wheel and swipe move between posts here rather than on the
            whole dialog, so the comment list scrolls normally. */}
        <div
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative flex-1 min-w-0 bg-black flex items-center justify-center min-h-[45vh] lg:min-h-0"
        >
          {items.length > 0 ? (
            <Media item={items[mediaIndex]} active />
          ) : (
            <p className="px-8 text-center text-white/90 text-lg font-semibold whitespace-pre-line">
              {post.body}
            </p>
          )}

          {items.length > 1 && (
            <>
              {mediaIndex > 0 && (
                <button
                  onClick={() => setMediaIndex((i) => i - 1)}
                  aria-label="Previous"
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition"
                >
                  <ChevronLeft size={17} className="text-white" />
                </button>
              )}
              {mediaIndex < items.length - 1 && (
                <button
                  onClick={() => setMediaIndex((i) => i + 1)}
                  aria-label="Next"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm flex items-center justify-center hover:bg-black/75 transition"
                >
                  <ChevronRight size={17} className="text-white" />
                </button>
              )}
              <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[11px] font-semibold">
                {mediaIndex + 1}/{items.length}
              </div>
            </>
          )}
        </div>

        {/* Creator, caption, conversation */}
        <aside className="w-full lg:w-[380px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col min-h-0">
          {/* Creator */}
          <div className="p-4 border-b border-white/10 flex items-center gap-3">
            <Link
              href={authorHref}
              className={`w-11 h-11 flex-shrink-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold overflow-hidden hover:brightness-110 transition ${
                realm ? 'rounded-xl' : 'rounded-full'
              }`}
            >
              {authorImage ? (
                <img src={authorImage} alt="" className="w-full h-full object-cover" />
              ) : (
                initialsOf(authorName)
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <Link
                href={authorHref}
                className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
              >
                <span className="truncate">{authorName}</span>
                {!realm && post.author.creatorStatus === 'APPROVED' && (
                  <VerifiedBadge size={14} />
                )}
              </Link>
              <p className="text-xs text-muted-foreground truncate">
                @{authorHandle} · {timeAgo(post.createdAt)}
              </p>
            </div>

            {!post.isMine && (
              <button
                onClick={handleFollow}
                disabled={followPending}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition disabled:opacity-60 flex-shrink-0 ${
                  post.author.followedByMe
                    ? 'glass-chip text-foreground hover:brightness-125'
                    : 'brand-gradient text-white hover:brightness-110'
                }`}
              >
                {followPending ? '…' : post.author.followedByMe ? 'Following' : 'Follow'}
              </button>
            )}
          </div>

          {/* Caption and comments share one scroll area, as on Instagram. */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {post.body && (
              <div className="p-4 border-b border-white/10">
                <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                  {post.body}
                </p>
              </div>
            )}

            <div className="p-4 space-y-4">
              {commentsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-24 rounded bg-white/[0.06] animate-pulse" />
                        <div className="h-3 w-full rounded bg-white/[0.06] animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No comments yet. Be the first.
                </p>
              ) : (
                <>
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-3">
                      <Link
                        href={`/app/u/${comment.author.username}`}
                        className="w-8 h-8 rounded-full flex-shrink-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-[10px] font-bold overflow-hidden"
                      >
                        {comment.author.avatarUrl ? (
                          <img
                            src={comment.author.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initialsOf(comment.author.displayName)
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <Link
                            href={`/app/u/${comment.author.username}`}
                            className="font-semibold hover:underline"
                          >
                            @{comment.author.username}
                          </Link>{' '}
                          <span className="text-muted-foreground text-xs">
                            {timeAgo(comment.createdAt)}
                          </span>
                        </p>
                        <p className="text-sm text-foreground/90 mt-0.5 whitespace-pre-line break-words">
                          {comment.body}
                        </p>
                      </div>
                    </div>
                  ))}

                  {commentsCursor && (
                    <button
                      onClick={loadMoreComments}
                      className="w-full text-center text-primary text-xs font-semibold py-2 hover:underline"
                    >
                      Load more comments
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-white/10 p-3 flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={handleLike}
                aria-label="Like"
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
              >
                <Heart
                  size={20}
                  fill={post.likedByMe ? '#ff3d6e' : 'none'}
                  stroke={post.likedByMe ? '#ff3d6e' : 'currentColor'}
                  className="text-foreground"
                />
                <span className="text-xs font-semibold text-foreground">
                  {fmt(post.likeCount)}
                </span>
              </button>

              <span className="flex items-center gap-1.5 px-2 py-1.5 text-muted-foreground">
                <MessageCircle size={20} />
                <span className="text-xs font-semibold">{fmt(post.commentCount)}</span>
              </span>

              <button
                onClick={handleRepost}
                aria-label="Repost"
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-white/5 transition"
              >
                <Repeat2
                  size={20}
                  className={post.repostedByMe ? 'text-emerald-400' : 'text-foreground'}
                />
                <span className="text-xs font-semibold text-foreground">
                  {fmt(post.repostCount ?? 0)}
                </span>
              </button>

              <button
                onClick={handleBookmark}
                aria-label="Save"
                className="p-2 rounded-lg hover:bg-white/5 transition"
              >
                <Bookmark
                  size={20}
                  fill={post.bookmarkedByMe ? 'currentColor' : 'none'}
                  className="text-foreground"
                />
              </button>

              <button
                onClick={handleShare}
                aria-label="Share"
                className="p-2 rounded-lg hover:bg-white/5 transition"
              >
                <Share2 size={20} className="text-foreground" />
              </button>

              <span className="ml-auto flex items-center gap-1.5 pr-1 text-muted-foreground">
                <Eye size={16} />
                <span className="text-xs font-semibold">{fmt(post.viewCount)}</span>
              </span>
            </div>

            <form onSubmit={submitComment} className="mt-2 flex items-center gap-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={isAuthenticated ? 'Add a comment…' : 'Sign in to comment'}
                className="flex-1 px-3 py-2 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Post comment"
                className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center text-white disabled:opacity-40 hover:brightness-110 transition flex-shrink-0"
              >
                {sending ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Send size={15} />
                )}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
}
