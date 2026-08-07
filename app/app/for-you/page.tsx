'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import {
  Heart, MessageCircle, Share2, Eye, Bookmark,
  Volume2, VolumeX, Play, Plus, Check, Loader2, X, Send,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import {
  postsApi,
  realmsApi,
  usersApi,
  type FeedPost,
  type PostAuthor,
  type PostComment,
  type PostRealm,
} from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { useRequireAuth } from '@/hooks/useRequireAuth';

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
  onShare,
  onToggleFollow,
}: {
  post: FeedPost;
  followPending: boolean;
  onLike: () => void;
  onOpenComments: () => void;
  onBookmark: () => void;
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

// ─── Video ────────────────────────────────────────────────────────────────────
function VideoContent({ post, isActive }: { post: FeedPost; isActive: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    if (!ref.current) return;
    if (isActive) {
      ref.current.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      ref.current.pause();
      setPlaying(false);
    }
  }, [isActive]);

  const togglePlay = () => {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  return (
    <div className="w-full h-full cursor-pointer select-none" onClick={togglePlay}>
      <video
        ref={ref}
        src={post.mediaUrls[0]}
        className="w-full h-full object-cover"
        loop
        muted={muted}
        playsInline
        preload="metadata"
      />

      {/* Play overlay */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <Play size={28} fill="white" className="text-white ml-1" />
          </div>
        </div>
      )}

      {/* Mute toggle */}
      <button
        onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
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

// ─── Photo ────────────────────────────────────────────────────────────────────
function PhotoContent({ post }: { post: FeedPost }) {
  return (
    <img
      src={post.mediaUrls[0]}
      alt={post.body ?? ''}
      className="w-full h-full object-cover"
      loading="lazy"
    />
  );
}

// ─── Carousel ─────────────────────────────────────────────────────────────────
function CarouselContent({ post }: { post: FeedPost }) {
  const [idx, setIdx] = useState(0);
  const imgs = post.mediaUrls;

  return (
    <div className="w-full h-full relative overflow-hidden">
      <img
        src={imgs[idx]}
        alt=""
        className="w-full h-full object-cover transition-opacity duration-300"
        loading="lazy"
      />

      {/* Dot indicators */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {imgs.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/40'
            }`}
          />
        ))}
      </div>

      {/* Prev */}
      {idx > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx((i) => i - 1); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10 hover:bg-black/60 transition"
        >
          <ChevronLeft size={16} className="text-white" />
        </button>
      )}

      {/* Next */}
      {idx < imgs.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); setIdx((i) => i + 1); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center z-10 hover:bg-black/60 transition"
        >
          <ChevronRight size={16} className="text-white" />
        </button>
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
  onBookmark, onShare, onToggleFollow,
}: {
  post: FeedPost;
  index: number;
  isActive: boolean;
  followPending: boolean;
  onVisible: () => void;
  onLike: () => void;
  onOpenComments: () => void;
  onBookmark: () => void;
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
      className="h-full snap-start flex items-center justify-center px-4 lg:px-10"
    >
      {/* Card + actions side by side */}
      <div className="flex items-end gap-3 h-full w-full max-w-xs sm:max-w-sm lg:max-w-none lg:w-auto py-4">
        {/* Media card */}
        <div className="relative flex-shrink-0 w-full lg:w-[390px] xl:w-[500px] h-full rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10">
          {post.kind === 'video' && <VideoContent post={post} isActive={isActive} />}
          {post.kind === 'image' && !isCarousel && <PhotoContent post={post} />}
          {isCarousel && <CarouselContent post={post} />}
          {post.kind === 'text' && <TextContent post={post} index={index} />}

          {/* Bottom overlay */}
          <div className="absolute bottom-0 left-0 right-0 px-4 pt-16 pb-5 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none">
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
                    <span className="w-4 h-4 brand-gradient rounded-full flex items-center justify-center text-[9px] text-white font-bold flex-shrink-0">
                      ✓
                    </span>
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

        {/* Action icons — right of card */}
        <ActionColumn
          post={post}
          followPending={followPending}
          onLike={onLike}
          onOpenComments={onOpenComments}
          onBookmark={onBookmark}
          onShare={onShare}
          onToggleFollow={onToggleFollow}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ForYouPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [current, setCurrent] = useState(0);
  const [commentsFor, setCommentsFor] = useState<FeedPost | null>(null);
  // Username currently being followed/unfollowed, so the badge can spin.
  const [followPending, setFollowPending] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  // Each post's view is counted once per session, not on every scroll pass.
  const viewedRef = useRef<Set<string>>(new Set());

  const { isAuthenticated } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  // First page. Refetches on sign-in so likedByMe reflects the viewer.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    postsApi
      .feed(null, PAGE_SIZE)
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

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await postsApi.feed(nextCursor, PAGE_SIZE);
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
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-white/70" />
      </div>
    );
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
        <p className="text-white font-semibold text-lg">Nothing here yet</p>
        <p className="text-white/60 text-sm mt-1 mb-5">
          Be the first to post something to the feed.
        </p>
        <a
          href="/app/upload"
          className="px-5 py-2.5 rounded-xl font-semibold text-white text-sm
            brand-gradient hover:brightness-110 transition"
        >
          Create a post
        </a>
      </div>
    );
  }

  return (
    // h-full here refers to the main flex-1 container height
    <div className="h-full overflow-hidden relative">
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
