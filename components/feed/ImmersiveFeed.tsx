'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Heart, MessageCircle, Share2, Eye, Bookmark, Repeat2,
  Volume2, VolumeX, Play, Plus, Check, Loader2, X, Send,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import {
  postsApi,
  realmsApi,
  usersApi,
  type FeedPost,
  type Page,
  type PostAuthor,
  type PostComment,
  type PostMediaItem,
  type PostRealm,
} from '@/lib/api';
import { useAuth, useToast, useVideoSound } from '@/lib/stores';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { VerifiedBadge } from '@/components/VerifiedBadge';

const PAGE_SIZE = 6;
// Start fetching the next page once the viewer is this many posts from the end.
const PREFETCH_THRESHOLD = 2;

// Backdrops for text-only posts. All four stay inside the brand's rose→violet
// arc so a text post never reads as belonging to a different product.
const TEXT_BACKGROUNDS = [
  'from-[#3B0B57] via-[#6D1F7A] to-[#8E1030]',
  'from-[#1A1424] via-[#2A1B36] to-[#12101A]',
  'from-[#8E1030] via-[#C4143F] to-[#5B0F3A]',
  'from-[#2E0F45] via-[#5B1B6B] to-[#1A1424]',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

// ─── Action button ────────────────────────────────────────────────────────────
function ActionBtn({
  icon, count, onClick,
}: {
  icon: React.ReactNode;
  count?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 group active:scale-90 transition-transform"
    >
      <div className="w-11 h-11 rounded-full glass-chip flex items-center justify-center group-hover:brightness-125 transition">
        {icon}
      </div>
      {count && (
        <span className="text-white text-xs font-semibold drop-shadow-sm">{count}</span>
      )}
    </button>
  );
}

// ─── Action column (right side) ───────────────────────────────────────────────
function ActionColumn({
  post,
  followPending,
  onLike,
  onOpenComments,
  onBookmark,
  onRepost,
  onShare,
  onToggleFollow,
}: {
  post: FeedPost;
  followPending: boolean;
  onLike: () => void;
  onOpenComments: () => void;
  onBookmark: () => void;
  onRepost: () => void;
  onShare: () => void;
  onToggleFollow: () => void;
}) {
  // A realm post is credited to the page, so the avatar column wears the realm's
  // identity and the follow badge follows the realm rather than the person.
  const realm = post.realm;
  const href = realm ? `/app/r/${realm.slug}` : `/app/u/${post.author.username}`;
  const handle = realm ? realm.slug : post.author.username;
  const imageUrl = realm ? realm.iconUrl : post.author.avatarUrl;
  const fallback = realm ? realm.name.charAt(0).toUpperCase() : initialsOf(post.author.displayName);
  const isFollowed = realm ? realm.followedByMe : post.author.followedByMe;

  return (
    <div className="flex flex-col items-center gap-4 pb-4 flex-shrink-0">
      {/* Avatar opens the profile behind the post; the badge follows it */}
      <div className="relative mb-2">
        <Link
          href={href}
          title={`View @${handle}`}
          className={`block w-12 h-12 bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/80 shadow-lg overflow-hidden hover:brightness-110 transition ${
            // Square-ish for a page, round for a person — the same visual
            // grammar Facebook and Instagram use.
            realm ? 'rounded-xl' : 'rounded-full'
          }`}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center">{fallback}</span>
          )}
        </Link>

        {/* Hidden on your own posts — following yourself isn't a thing. */}
        {!post.isMine && (
          <button
            onClick={onToggleFollow}
            disabled={followPending}
            title={isFollowed ? 'Unfollow' : 'Follow'}
            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center shadow transition disabled:opacity-70 ${
              isFollowed ? 'bg-white' : 'brand-gradient hover:brightness-110'
            }`}
          >
            {followPending ? (
              <Loader2 size={10} className="text-white animate-spin" />
            ) : isFollowed ? (
              <Check size={11} className="text-primary" strokeWidth={3} />
            ) : (
              <Plus size={11} className="text-white" strokeWidth={3} />
            )}
          </button>
        )}
      </div>

      <ActionBtn
        icon={
          <Heart
            size={22}
            fill={post.likedByMe ? '#ff3d6e' : 'none'}
            stroke={post.likedByMe ? '#ff3d6e' : 'white'}
          />
        }
        count={fmt(post.likeCount)}
        onClick={onLike}
      />
      <ActionBtn
        icon={<MessageCircle size={22} stroke="white" />}
        count={fmt(post.commentCount)}
        onClick={onOpenComments}
      />
      <ActionBtn
        icon={
          <Bookmark
            size={22}
            fill={post.bookmarkedByMe ? 'white' : 'none'}
            stroke="white"
          />
        }
        count={fmt(post.bookmarkCount)}
        onClick={onBookmark}
      />
      <ActionBtn
        icon={
          <Repeat2
            size={22}
            // Filling a Repeat2 glyph reads as a smudge, so an active repost is
            // shown by colour instead.
            stroke={post.repostedByMe ? '#22c55e' : 'white'}
          />
        }
        count={fmt(post.repostCount ?? 0)}
        onClick={onRepost}
      />
      <ActionBtn
        icon={<Share2 size={22} stroke="white" />}
        onClick={onShare}
      />

      <div className="flex flex-col items-center gap-1 text-white/70">
        <Eye size={18} />
        <span className="text-xs font-semibold">{fmt(post.viewCount)}</span>
      </div>
    </div>
  );
}

// ─── One video slide ──────────────────────────────────────────────────────────
/**
 * The author's chosen frame as a CSS aspect-ratio, or null to fill the card.
 *
 * Only video needs this: images were cropped for real before upload, so their
 * own dimensions already carry the decision.
 */
function frameStyle(post: FeedPost): React.CSSProperties | undefined {
  if (post.kind !== 'video' || !post.aspectRatio || post.aspectRatio === 'ORIGINAL') {
    return undefined;
  }
  const [w, h] = post.aspectRatio.split(':').map(Number);
  if (!w || !h) return undefined;
  return { aspectRatio: `${w} / ${h}`, margin: 'auto' };
}

function VideoSlide({
  url,
  active,
  frame,
}: {
  url: string;
  active: boolean;
  /** Set when the author chose a ratio; letterboxes rather than fills. */
  frame?: React.CSSProperties;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const muted = useVideoSound((s) => s.muted);
  const toggleMuted = useVideoSound((s) => s.toggleMuted);

  // Only the slide the viewer is actually on plays: a post can hold several
  // videos, and all of them playing at once would be a wall of noise.
  useEffect(() => {
    if (!ref.current) return;
    if (active) {
      ref.current.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      ref.current.pause();
      setPlaying(false);
    }
  }, [active]);

  const togglePlay = () => {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  return (
    <div
      className={`relative cursor-pointer select-none ${
        frame ? 'max-w-full max-h-full' : 'w-full h-full'
      }`}
      style={frame}
      onClick={togglePlay}
    >
      <video
        ref={ref}
        src={url}
        className="w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="metadata"
      />

      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Play size={28} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      <button
        onClick={(e) => { e.stopPropagation(); toggleMuted(); }}
        className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center hover:bg-black/70 transition z-10"
      >
        {muted
          ? <VolumeX size={16} className="text-white" />
          : <Volume2 size={16} className="text-white" />
        }
      </button>
    </div>
  );
}

// ─── Media ────────────────────────────────────────────────────────────────────
/**
 * Every media item on a post, swipeable. A post can mix a video with images, so
 * each slide is rendered from its own kind rather than from the post's — driving
 * the whole post off `post.kind` dropped everything after the first item, or drew
 * a video into an `<img>`.
 *
 * The track is a native horizontal scroll-snap container: that gives real
 * touch swiping on mobile and trackpad swiping on desktop for free, and the
 * arrows just scroll it. A JS drag handler would have to re-implement momentum,
 * rubber-banding and pointer capture, and would still feel worse.
 */
function MediaCarousel({ post, isActive }: { post: FeedPost; isActive: boolean }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  // `media` is authoritative. The fallback keeps this working against an API
  // build that predates per-item kinds, where only `mediaUrls` is sent.
  const items: PostMediaItem[] = post.media?.length
    ? post.media
    : post.mediaUrls.map((url) => ({
        url,
        kind: post.kind === 'video' ? 'video' : 'image',
      }));

  const count = items.length;

  // Derived from scroll position, so it stays right no matter what moved the
  // track — swipe, arrow, or trackpad.
  const handleScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next >= 0 && next < count) setIdx(next);
  };

  const goTo = (i: number) => {
    const el = trackRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(count - 1, i));
    el.scrollTo({ left: target * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className={`w-full h-full flex ${
          count > 1 ? 'overflow-x-auto snap-x snap-mandatory' : 'overflow-hidden'
        } [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden`}
      >
        {items.map((item, i) => (
          <div
            key={`${item.url}-${i}`}
            className="relative w-full h-full flex-shrink-0 snap-center flex items-center justify-center"
          >
            {item.kind === 'video' ? (
              <VideoSlide url={item.url} active={isActive && i === idx} frame={frameStyle(post)} />
            ) : (
              <>
                {/* A blurred copy fills the letterbox, so a 1:1 image in a tall
                    card sits on its own colours instead of dead black bars. */}
                <img
                  src={item.url}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-40"
                  draggable={false}
                />
                <img
                  src={item.url}
                  alt={post.body ?? ''}
                  // `contain`, not `cover`: the author already cropped this to the
                  // ratio they chose, so covering it here would crop their crop.
                  className="relative w-full h-full object-contain"
                  // The lead image is what the viewer is waiting on; the rest can wait.
                  loading={i === 0 ? undefined : 'lazy'}
                  draggable={false}
                />
              </>
            )}
          </div>
        ))}
      </div>

      {count > 1 && (
        <>
          {/* Counter, so it's obvious there is more than one item */}
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm text-white text-[11px] font-semibold z-10">
            {idx + 1}/{count}
          </div>

          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.stopPropagation(); goTo(i); }}
                aria-label={`Go to item ${i + 1}`}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* Arrows are pointer-only — touch users swipe. */}
          {idx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); goTo(idx - 1); }}
              aria-label="Previous"
              className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm items-center justify-center z-10 hover:bg-black/60 transition"
            >
              <ChevronLeft size={16} className="text-white" />
            </button>
          )}
          {idx < count - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); goTo(idx + 1); }}
              aria-label="Next"
              className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm items-center justify-center z-10 hover:bg-black/60 transition"
            >
              <ChevronRight size={16} className="text-white" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ─── Text post ────────────────────────────────────────────────────────────────
function TextContent({ post, index }: { post: FeedPost; index: number }) {
  // Deterministic per feed position so the background is stable across renders.
  const bg = TEXT_BACKGROUNDS[index % TEXT_BACKGROUNDS.length];

  return (
    <div
      className={`w-full h-full bg-gradient-to-br ${bg} flex items-center justify-center p-10`}
    >
      <p className="text-white text-xl font-bold text-center leading-relaxed whitespace-pre-line drop-shadow-lg">
        {post.body}
      </p>
    </div>
  );
}

// ─── One comment, with its reply thread ───────────────────────────────────────
function CommentAvatar({ author, size = 8 }: { author: PostAuthor; size?: 6 | 8 }) {
  const dim = size === 6 ? 'w-6 h-6 text-[9px]' : 'w-8 h-8 text-[10px]';
  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center font-bold text-white flex-shrink-0 overflow-hidden`}
    >
      {author.avatarUrl ? (
        <img src={author.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        initialsOf(author.displayName)
      )}
    </div>
  );
}

function CommentRow({
  comment,
  replies,
  expanded,
  loadingReplies,
  onToggleReplies,
  onReply,
}: {
  comment: PostComment;
  replies: PostComment[];
  expanded: boolean;
  loadingReplies: boolean;
  onToggleReplies: () => void;
  onReply: () => void;
}) {
  return (
    <div className="flex gap-3">
      <Link href={`/app/u/${comment.author.username}`}>
        <CommentAvatar author={comment.author} />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">
          <Link
            href={`/app/u/${comment.author.username}`}
            className="font-semibold text-foreground hover:underline"
          >
            @{comment.author.username}
          </Link>
          {' · '}
          {timeAgo(comment.createdAt)}
        </p>
        <p className="text-sm text-foreground whitespace-pre-line break-words">{comment.body}</p>

        <div className="flex items-center gap-4 mt-1">
          <button
            onClick={onReply}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Reply
          </button>

          {comment.replyCount > 0 && (
            <button
              onClick={onToggleReplies}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              {loadingReplies ? (
                <Loader2 size={11} className="animate-spin" />
              ) : expanded ? (
                <ChevronUp size={12} />
              ) : (
                <ChevronDown size={12} />
              )}
              {expanded
                ? 'Hide replies'
                : `View ${comment.replyCount} ${comment.replyCount === 1 ? 'reply' : 'replies'}`}
            </button>
          )}
        </div>

        {/* Replies — one level deep, indented under the parent */}
        {expanded && replies.length > 0 && (
          <div className="mt-3 space-y-3 pl-3 border-l border-border">
            {replies.map((r) => (
              <div key={r.id} className="flex gap-2">
                <Link href={`/app/u/${r.author.username}`}>
                  <CommentAvatar author={r.author} size={6} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">
                    <Link
                      href={`/app/u/${r.author.username}`}
                      className="font-semibold text-foreground hover:underline"
                    >
                      @{r.author.username}
                    </Link>
                    {' · '}
                    {timeAgo(r.createdAt)}
                  </p>
                  <p className="text-[13px] text-foreground whitespace-pre-line break-words">
                    {r.body}
                  </p>
                  <button
                    onClick={onReply}
                    className="text-[11px] font-semibold text-muted-foreground hover:text-foreground transition mt-0.5"
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Comments drawer ──────────────────────────────────────────────────────────
function CommentsPanel({
  post,
  onClose,
  onCommentAdded,
}: {
  post: FeedPost;
  onClose: () => void;
  onCommentAdded: (postId: string) => void;
}) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Replies are keyed by their parent comment id and fetched on expand.
  const [replies, setReplies] = useState<Record<string, PostComment[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadingReplies, setLoadingReplies] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<PostComment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    postsApi
      .comments(post.id, null, 20)
      .then((page) => {
        if (cancelled) return;
        setComments(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) addToast({ message: 'Could not load comments.', type: 'error', duration: 4000 });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [post.id, addToast]);

  const loadMore = async () => {
    if (!nextCursor) return;
    try {
      const page = await postsApi.comments(post.id, nextCursor, 20);
      setComments((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more comments.', type: 'error', duration: 4000 });
    }
  };

  // Replying to a reply threads under its parent, so the target is the root.
  const threadRootOf = (comment: PostComment) => comment.parentId ?? comment.id;

  const fetchReplies = async (parentId: string) => {
    setLoadingReplies(parentId);
    try {
      const page = await postsApi.replies(parentId, null, 50);
      setReplies((prev) => ({ ...prev, [parentId]: page.items }));
    } catch {
      addToast({ message: 'Could not load replies.', type: 'error', duration: 4000 });
    } finally {
      setLoadingReplies(null);
    }
  };

  const toggleReplies = async (comment: PostComment) => {
    const isOpen = Boolean(expanded[comment.id]);
    setExpanded((prev) => ({ ...prev, [comment.id]: !isOpen }));

    if (!isOpen && !replies[comment.id]) {
      await fetchReplies(comment.id);
    }
  };

  const submit = () => {
    const body = draft.trim();
    if (!body || sending) return;

    requireAuth(async () => {
      setSending(true);
      const target = replyTo;
      const rootId = target ? threadRootOf(target) : undefined;

      try {
        const comment = await postsApi.addComment(post.id, body, rootId);

        if (rootId) {
          // Slot the reply into its thread and bump the parent's counter.
          setReplies((prev) => ({ ...prev, [rootId]: [...(prev[rootId] ?? []), comment] }));
          setExpanded((prev) => ({ ...prev, [rootId]: true }));
          setComments((prev) =>
            prev.map((c) => (c.id === rootId ? { ...c, replyCount: c.replyCount + 1 } : c)),
          );
        } else {
          setComments((prev) => [comment, ...prev]);
        }

        onCommentAdded(post.id);
        setDraft('');
        setReplyTo(null);
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

  // Focus the box when a Reply button sets a target.
  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      <div className="relative glass-card w-full sm:max-w-md h-[70vh] sm:h-[75vh] rounded-t-2xl sm:rounded-2xl flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h3 className="font-semibold text-foreground">
            {post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">
              No comments yet. Be the first.
            </p>
          ) : (
            <>
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  replies={replies[c.id] ?? []}
                  expanded={Boolean(expanded[c.id])}
                  loadingReplies={loadingReplies === c.id}
                  onToggleReplies={() => toggleReplies(c)}
                  onReply={() => setReplyTo(c)}
                />
              ))}

              {nextCursor && (
                <button
                  onClick={loadMore}
                  className="w-full text-center text-primary text-sm font-medium py-2 hover:underline"
                >
                  Load more comments
                </button>
              )}
            </>
          )}
        </div>

        <div className="border-t border-border flex-shrink-0">
          {replyTo && (
            <div className="flex items-center justify-between px-4 pt-2 text-xs text-muted-foreground">
              <span>
                Replying to <span className="text-foreground font-semibold">@{replyTo.author.username}</span>
              </span>
              <button onClick={() => setReplyTo(null)} className="hover:text-foreground">
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-3">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === 'Escape' && replyTo) setReplyTo(null);
              }}
              placeholder={replyTo ? `Reply to @${replyTo.author.username}…` : 'Add a comment…'}
              maxLength={1000}
              className="flex-1 px-3 py-2 glass-input rounded-xl text-sm text-foreground placeholder-muted-foreground"
            />
            <button
              onClick={submit}
              disabled={!draft.trim() || sending}
              className="w-9 h-9 rounded-lg brand-gradient text-primary-foreground flex items-center justify-center disabled:opacity-50"
            >
              {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Single feed item ─────────────────────────────────────────────────────────
function FeedItem({
  post, index, isActive, followPending, onVisible, onLike, onOpenComments,
  onBookmark, onRepost, onShare, onToggleFollow,
}: {
  post: FeedPost;
  index: number;
  isActive: boolean;
  followPending: boolean;
  onVisible: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onBookmark: () => void;
  onRepost: () => void;
  onShare: () => void;
  onToggleFollow: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) onVisible(); },
      { threshold: 0.6 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [onVisible]);

  const isCarousel = post.kind === 'image' && post.mediaUrls.length > 1;

  return (
    <div
      ref={ref}
      className="h-full snap-start flex items-center justify-center lg:px-10"
    >
      {/* Mobile is edge-to-edge with the rail floating over the media; from `lg`
          the card becomes a fixed-width panel and the rail sits beside it. The
          wrapper is `relative` so one rail instance can do both jobs. */}
      <div className="relative flex items-end h-full w-full lg:w-auto lg:gap-3 lg:py-4">
        {/* Media card */}
        <div className="relative w-full h-full overflow-hidden bg-black lg:flex-shrink-0 lg:w-[390px] xl:w-[500px] lg:rounded-2xl lg:shadow-2xl lg:ring-1 lg:ring-white/10">
          {post.kind === 'text' ? (
            <TextContent post={post} index={index} />
          ) : (
            <MediaCarousel post={post} isActive={isActive} />
          )}

          {/* Bottom overlay. On mobile the media runs under the fixed tab bar, so
              the caption keeps clear of it — and of the rail on its right. Left and
              right are set separately because `px-*` and `pr-*` would collide. */}
          <div className="absolute bottom-0 left-0 right-0 pl-4 pr-20 pt-16 pb-24 lg:pr-4 lg:pb-5 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
            {/* A realm post is credited to the page, with the owner named just
                below so attribution is never hidden. */}
            <div className="flex items-center gap-1.5 mb-1 pointer-events-auto flex-wrap">
              {post.realm ? (
                <>
                  <Link
                    href={`/app/r/${post.realm.slug}`}
                    className="text-white font-bold text-sm drop-shadow hover:underline"
                  >
                    {post.realm.name}
                  </Link>
                  <span className="px-1.5 py-0.5 rounded bg-white/15 text-white text-[9px] font-bold uppercase tracking-wide flex-shrink-0">
                    Realm
                  </span>
                </>
              ) : (
                <>
                  <Link
                    href={`/app/u/${post.author.username}`}
                    className="text-white font-bold text-sm drop-shadow hover:underline"
                  >
                    @{post.author.username}
                  </Link>
                  {post.author.creatorStatus === 'APPROVED' && (
                    <VerifiedBadge size={16} />
                  )}
                </>
              )}
              <span className="text-white/50 text-xs">· {timeAgo(post.createdAt)}</span>
            </div>

            {post.realm && (
              <Link
                href={`/app/u/${post.author.username}`}
                className="inline-block mb-1 pointer-events-auto text-white/60 text-xs drop-shadow hover:underline"
              >
                by @{post.author.username}
              </Link>
            )}
            {/* Media posts carry their text as a caption; text posts already show it. */}
            {post.kind !== 'text' && post.body && (
              <p className="text-white/95 text-sm leading-snug drop-shadow line-clamp-3">
                {post.body}
              </p>
            )}
          </div>
        </div>

        {/* Action icons — over the media on mobile, right of the card on desktop.
            `lg:static` hands it back to the flex row so nothing is clipped. */}
        <div className="absolute right-1.5 bottom-24 z-20 lg:static lg:right-auto lg:bottom-auto lg:z-auto">
          <ActionColumn
            post={post}
            followPending={followPending}
            onLike={onLike}
            onOpenComments={onOpenComments}
            onBookmark={onBookmark}
            onRepost={onRepost}
            onShare={onShare}
            onToggleFollow={onToggleFollow}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
/**
 * Mirrors the real layout — one media card with the action rail beside it — so
 * the first paint has the shape of the feed rather than a spinner in the void.
 * Exported because the app shell shows it before this component even mounts.
 */
export function FeedSkeleton() {
  return (
    <div className="h-full overflow-hidden flex items-center justify-center lg:px-10">
      <div className="relative flex items-end h-full w-full lg:w-auto lg:gap-3 lg:py-4">
        <div className="relative w-full h-full overflow-hidden bg-white/[0.04] animate-pulse lg:flex-shrink-0 lg:w-[390px] xl:w-[500px] lg:rounded-2xl">
          {/* Caption placeholder, where the real one sits */}
          <div className="absolute bottom-0 left-0 right-0 pl-4 pr-20 pb-24 lg:pr-4 lg:pb-5 space-y-2">
            <div className="h-3 w-32 rounded bg-white/10" />
            <div className="h-3 w-52 rounded bg-white/10" />
            <div className="h-3 w-40 rounded bg-white/10" />
          </div>
        </div>

        {/* Action rail placeholder */}
        <div className="absolute right-1.5 bottom-24 z-20 lg:static lg:right-auto lg:bottom-auto flex flex-col items-center gap-4 pb-4">
          <div className="w-12 h-12 rounded-full bg-white/[0.06] animate-pulse mb-2" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="w-11 h-11 rounded-full bg-white/[0.06] animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function CloseButton({ onClose, title }: { onClose: () => void; title?: string }) {
  return (
    <div className="absolute top-3 left-3 z-50 flex items-center gap-2">
      <button
        onClick={onClose}
        aria-label="Close"
        className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center hover:bg-black/80 transition"
      >
        <X size={18} className="text-white" />
      </button>
      {title && (
        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs font-semibold">
          {title}
        </span>
      )}
    </div>
  );
}

// ─── Feed ─────────────────────────────────────────────────────────────────────
export interface ImmersiveFeedProps {
  /** Fetches one page. Identity decides what this feed *is* — see `fetchPage` note. */
  fetchPage: (cursor: string | null) => Promise<Page<FeedPost>>;
  /**
   * Posts the caller already has. Supplying these skips the opening fetch, which
   * is what lets a profile tab open instantly at the post that was tapped.
   */
  initialPosts?: FeedPost[];
  initialCursor?: string | null;
  /** Which post to open on. Only read on mount. */
  initialIndex?: number;
  /** Provided by overlay callers; renders a close affordance. */
  onClose?: () => void;
  /** Shown top-left beside the close button, e.g. "Liked". */
  title?: string;
  /** Copy for the empty state, which differs per collection. */
  emptyTitle?: string;
  emptyBody?: string;
  /** Bubbles like/bookmark/repost changes so a parent grid can stay in step. */
  onPostChanged?: (post: FeedPost) => void;
}

export function ImmersiveFeed({
  fetchPage,
  initialPosts,
  initialCursor = null,
  initialIndex = 0,
  onClose,
  title,
  emptyTitle = 'Nothing here yet',
  emptyBody = 'Be the first to post something to the feed.',
  onPostChanged,
}: ImmersiveFeedProps) {
  const [posts, setPosts] = useState<FeedPost[]>(initialPosts ?? []);
  const [loading, setLoading] = useState(!initialPosts?.length);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [current, setCurrent] = useState(initialIndex);
  const [commentsFor, setCommentsFor] = useState<FeedPost | null>(null);
  // Username currently being followed/unfollowed, so the badge can spin.
  const [followPending, setFollowPending] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  // Each post's view is counted once per session, not on every scroll pass.
  const viewedRef = useRef<Set<string>>(new Set());
  // `fetchPage` is typically an inline arrow, so a new identity every render.
  // Holding it in a ref keeps it out of effect deps that would otherwise refetch
  // (or re-run the initial jump) on each parent render.
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const seededRef = useRef(Boolean(initialPosts?.length));

  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  // First page. Refetches on sign-in so likedByMe reflects the viewer. Skipped
  // when the caller seeded us — those posts came from the same endpoint already.
  useEffect(() => {
    if (seededRef.current) {
      seededRef.current = false;
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPageRef
      .current(null)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load the feed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Open on the requested post. Runs once the list is on screen, since the snap
  // container has to exist before it can be scrolled.
  const jumpedRef = useRef(false);
  useEffect(() => {
    if (jumpedRef.current || loading || !posts.length || initialIndex <= 0) return;
    jumpedRef.current = true;
    const child = containerRef.current?.children[initialIndex] as HTMLElement | undefined;
    // No smooth scroll — the viewer should already *be* there, not travel there.
    child?.scrollIntoView({ behavior: 'auto' });
  }, [loading, posts.length, initialIndex]);

  // Escape closes an overlay feed. Bound here rather than on the container so it
  // works without the feed having focus.
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchPageRef.current(nextCursor);
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
  }, [nextCursor, addToast]);

  // Infinite feed: fetch ahead while the viewer is still watching earlier posts.
  useEffect(() => {
    if (posts.length && current >= posts.length - PREFETCH_THRESHOLD) {
      loadMore();
    }
  }, [current, posts.length, loadMore]);

  const handleVisible = useCallback((index: number, post: FeedPost) => {
    setCurrent(index);

    if (!viewedRef.current.has(post.id)) {
      viewedRef.current.add(post.id);
      // Best effort — a failed view count shouldn't disturb playback.
      postsApi.registerView(post.id).catch(() => {});
      setPosts((prev) =>
        prev.map((p) => (p.id === post.id ? { ...p, viewCount: p.viewCount + 1 } : p)),
      );
    }
  }, []);

  const handleLike = (post: FeedPost) => {
    requireAuth(async () => {
      const optimistic = {
        likedByMe: !post.likedByMe,
        likeCount: post.likeCount + (post.likedByMe ? -1 : 1),
      };
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...optimistic } : p)));

      try {
        const res = await postsApi.toggleLike(post.id);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id ? { ...p, likedByMe: res.liked, likeCount: res.likeCount } : p,
          ),
        );
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, likedByMe: post.likedByMe, likeCount: post.likeCount }
              : p,
          ),
        );
        addToast({ message: 'Could not register your like.', type: 'error', duration: 4000 });
      }
    });
  };

  const handleBookmark = (post: FeedPost) => {
    requireAuth(async () => {
      const optimistic = {
        bookmarkedByMe: !post.bookmarkedByMe,
        bookmarkCount: post.bookmarkCount + (post.bookmarkedByMe ? -1 : 1),
      };
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...optimistic } : p)));

      try {
        const res = await postsApi.toggleBookmark(post.id);
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, bookmarkedByMe: res.bookmarked, bookmarkCount: res.bookmarkCount }
              : p,
          ),
        );
        addToast({
          message: res.bookmarked ? 'Saved to your favorites.' : 'Removed from favorites.',
          type: 'success',
          duration: 2500,
        });
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, bookmarkedByMe: post.bookmarkedByMe, bookmarkCount: post.bookmarkCount }
              : p,
          ),
        );
        addToast({ message: 'Could not save this post.', type: 'error', duration: 4000 });
      }
    });
  };

  const handleRepost = (post: FeedPost) => {
    requireAuth(async () => {
      const optimistic = {
        repostedByMe: !post.repostedByMe,
        repostCount: (post.repostCount ?? 0) + (post.repostedByMe ? -1 : 1),
      };
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, ...optimistic } : p)));

      try {
        const res = await postsApi.toggleRepost(post.id);
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== post.id) return p;
            const next = { ...p, repostedByMe: res.reposted, repostCount: res.repostCount };
            onPostChanged?.(next);
            return next;
          }),
        );
        addToast({
          message: res.reposted ? 'Reposted to your profile.' : 'Repost removed.',
          type: 'success',
          duration: 2500,
        });
      } catch {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === post.id
              ? { ...p, repostedByMe: post.repostedByMe, repostCount: post.repostCount }
              : p,
          ),
        );
        addToast({ message: 'Could not repost this.', type: 'error', duration: 4000 });
      }
    });
  };

  /**
   * Realm posts follow the page, personal posts follow the person — the badge
   * on the card is bound to whichever identity the post is credited to.
   */
  const handleToggleFollowRealm = (realm: PostRealm) => {
    requireAuth(async () => {
      if (followPending) return;
      setFollowPending(realm.slug);

      const next = !realm.followedByMe;
      // The same realm can appear more than once in the feed.
      const setFollowState = (value: boolean) =>
        setPosts((prev) =>
          prev.map((p) =>
            p.realm?.id === realm.id ? { ...p, realm: { ...p.realm, followedByMe: value } } : p,
          ),
        );

      setFollowState(next);

      try {
        const res = await realmsApi.toggleFollow(realm.slug);
        setFollowState(res.following);
        addToast({
          message: res.following ? `Following ${realm.name}` : `Unfollowed ${realm.name}`,
          type: 'success',
          duration: 2500,
        });
      } catch (err) {
        setFollowState(!next);
        addToast({
          message: err instanceof Error ? err.message : 'Could not update follow.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setFollowPending(null);
      }
    });
  };

  const handleToggleFollow = (author: PostAuthor) => {
    requireAuth(async () => {
      if (followPending) return;
      setFollowPending(author.username);

      const next = !author.followedByMe;
      // Applied to every post by this author, since the same person can appear
      // more than once in the feed.
      const setFollowState = (value: boolean) =>
        setPosts((prev) =>
          prev.map((p) =>
            p.author.username === author.username
              ? { ...p, author: { ...p.author, followedByMe: value } }
              : p,
          ),
        );

      setFollowState(next);

      try {
        const res = await usersApi.toggleFollow(author.username);
        setFollowState(res.following);
        addToast({
          message: res.following
            ? `Following @${author.username}`
            : `Unfollowed @${author.username}`,
          type: 'success',
          duration: 2500,
        });
      } catch (err) {
        setFollowState(!next);
        addToast({
          message: err instanceof Error ? err.message : 'Could not update follow.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setFollowPending(null);
      }
    });
  };

  const handleShare = async (post: FeedPost) => {
    const url = `${window.location.origin}/app/for-you?post=${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `@${post.author.username} on Signal Face`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      addToast({ message: 'Link copied to clipboard.', type: 'success', duration: 3000 });
    } catch {
      // User dismissed the share sheet — nothing to report.
    }
  };

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(posts.length - 1, idx));
      const child = containerRef.current?.children[clamped] as HTMLElement | undefined;
      child?.scrollIntoView({ behavior: 'smooth' });
    },
    [posts.length],
  );

  if (loading) {
    return <FeedSkeleton />;
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        <p className="text-white font-semibold">Could not load the feed</p>
        <p className="text-white/60 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6">
        {onClose && <CloseButton onClose={onClose} title={title} />}
        <p className="text-white font-semibold text-lg">{emptyTitle}</p>
        <p className="text-white/60 text-sm mt-1 mb-5">{emptyBody}</p>
        {!onClose && (
          <a
            href="/app/upload"
            className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm
              brand-gradient hover:brightness-110 transition"
          >
            Create a post
          </a>
        )}
      </div>
    );
  }

  return (
    // h-full here refers to the main flex-1 container height
    <div className="h-full overflow-hidden relative">
      {onClose && <CloseButton onClose={onClose} title={title} />}

      {/* Desktop up/down nav arrows */}
      <div className="hidden lg:flex flex-col gap-3 fixed right-8 top-1/2 -translate-y-1/2 z-50">
        <button
          onClick={() => goTo(current - 1)}
          disabled={current === 0}
          className="w-10 h-10 rounded-full glass-chip flex items-center justify-center hover:brightness-125 transition disabled:opacity-30"
        >
          <ChevronUp size={20} className="text-white" />
        </button>
        <button
          onClick={() => goTo(current + 1)}
          disabled={current === posts.length - 1 && !nextCursor}
          className="w-10 h-10 rounded-full glass-chip flex items-center justify-center hover:brightness-125 transition disabled:opacity-30"
        >
          <ChevronDown size={20} className="text-white" />
        </button>
      </div>

      {/* Snap feed */}
      <div
        ref={containerRef}
        className="h-full overflow-y-scroll snap-y snap-mandatory
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {posts.map((post, i) => (
          <FeedItem
            key={post.id}
            post={post}
            index={i}
            isActive={i === current}
            onVisible={() => handleVisible(i, post)}
            onLike={() => handleLike(post)}
            onOpenComments={() => setCommentsFor(post)}
            followPending={followPending === (post.realm?.slug ?? post.author.username)}
            onBookmark={() => handleBookmark(post)}
            onRepost={() => handleRepost(post)}
            onShare={() => handleShare(post)}
            onToggleFollow={() =>
              post.realm
                ? handleToggleFollowRealm(post.realm)
                : handleToggleFollow(post.author)
            }
          />
        ))}

        {loadingMore && (
          <div className="h-24 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin text-white/60" />
          </div>
        )}
      </div>

      {commentsFor && (
        <CommentsPanel
          post={posts.find((p) => p.id === commentsFor.id) ?? commentsFor}
          onClose={() => setCommentsFor(null)}
          onCommentAdded={(postId) =>
            setPosts((prev) =>
              prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)),
            )
          }
        />
      )}
    </div>
  );
}
