// components/social/PostCard.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/hooks/useToast';
import { useVideoSound } from '@/lib/stores';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faHeart,
  faComment,
  faBookmark,
  faShare,
  faPlay,
  faPause,
  faVolumeHigh,
  faVolumeXmark,
  faPlus,
} from '@fortawesome/free-solid-svg-icons';
import { Post } from '@/lib/types/post';
import { mockComments } from '@/lib/mock';
import { CommentSheet } from './CommentSheet';
import { VerifiedBadge } from '@/components/VerifiedBadge';

interface PostCardProps {
  post: Post;
}

function formatCount(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

export function PostCard({ post }: PostCardProps) {
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.likes);
  const [bookmarked, setBookmarked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showBigHeart, setShowBigHeart] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const muted = useVideoSound((s) => s.muted);
  const toggleMuted = useVideoSound((s) => s.toggleMuted);
  const [progress, setProgress] = useState(0);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { requireAuth } = useRequireAuth();
  const { showToast } = useToast();

  // Autoplay/pause video when it scrolls in/out of view
  useEffect(() => {
    if (post.type !== 'video' || !containerRef.current) return;
    const el = containerRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!videoRef.current) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        } else {
          videoRef.current.pause();
          setIsPlaying(false);
        }
      },
      { threshold: [0.6] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [post.type]);

  const handleLike = (silent = false) => {
    requireAuth(() => {
      setLiked((prev) => {
        const next = !prev;
        setLikeCount((c) => (next ? c + 1 : c - 1));
        if (!silent) showToast(next ? 'Liked post' : 'Unliked post', 'success');
        return next;
      });
    });
  };

  const handleDoubleTap = () => {
    requireAuth(() => {
      if (!liked) handleLike(true);
      setShowBigHeart(true);
      setTimeout(() => setShowBigHeart(false), 700);
    });
  };

  const handleBookmark = () => {
    requireAuth(() => {
      setBookmarked((prev) => {
        showToast(!prev ? 'Saved to bookmarks' : 'Removed bookmark', 'success');
        return !prev;
      });
    });
  };

  const handleShare = () => {
    requireAuth(() => showToast('Share feature coming soon', 'info'));
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleMuted();
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const { currentTime, duration } = videoRef.current;
    if (duration) setProgress((currentTime / duration) * 100);
  };

  let lastTap = 0;
  const handleMediaClick = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      handleDoubleTap();
    } else if (post.type === 'video') {
      togglePlay();
    }
    lastTap = now;
  };

  return (
    <div ref={containerRef} className="flex items-stretch gap-3 snap-start h-[calc(100dvh-6rem)] max-h-[820px]">
      {/* Media panel */}
      <div
        className="relative flex-1 max-w-[420px] mx-auto bg-black rounded-2xl overflow-hidden ring-1 ring-white/10 cursor-pointer select-none"
        onClick={handleMediaClick}
      >
        {/* VIDEO */}
        {post.type === 'video' && (
          <>
            <video
              ref={videoRef}
              src={post.videoUrl}
              poster={post.poster}
              className="w-full h-full object-cover"
              loop
              muted={muted}
              autoPlay
              playsInline
              onTimeUpdate={handleTimeUpdate}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <FontAwesomeIcon icon={faPlay} className="h-14 w-14 text-white/90" />
              </div>
            )}
            <button
              onClick={toggleMute}
              className="absolute top-3 right-3 h-8 w-8 rounded-full glass-chip flex items-center justify-center text-white z-10"
            >
              <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} className="h-3.5 w-3.5" />
            </button>
            {/* progress bar */}
            <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/20 z-10">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
          </>
        )}

        {/* IMAGE */}
        {post.type === 'image' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imageUrl} alt={post.caption} className="w-full h-full object-cover" />
        )}

        {/* CAROUSEL */}
        {post.type === 'carousel' && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.images[carouselIndex]}
              alt={`${post.caption} ${carouselIndex + 1}`}
              className="w-full h-full object-cover"
            />
            {carouselIndex > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCarouselIndex((i) => Math.max(0, i - 1));
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full glass-chip text-white z-10"
              >
                ‹
              </button>
            )}
            {carouselIndex < post.images.length - 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCarouselIndex((i) => Math.min(post.images.length - 1, i + 1));
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full glass-chip text-white z-10"
              >
                ›
              </button>
            )}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-1 z-10">
              {post.images.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === carouselIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          </>
        )}

        {/* TEXT */}
        {post.type === 'text' && (
          <div
            className="w-full h-full flex items-center justify-center p-8"
            style={{ background: post.bgGradient ?? 'linear-gradient(135deg,#312e81,#7c3aed)' }}
          >
            <p className="text-white text-2xl font-semibold text-center leading-snug">{post.content}</p>
          </div>
        )}

        {/* Double-tap heart burst */}
        {showBigHeart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <FontAwesomeIcon
              icon={faHeart}
              className="h-24 w-24 text-white drop-shadow-lg animate-ping-once"
              style={{ color: '#ef4444' }}
            />
          </div>
        )}

        {/* Bottom scrim + creator info */}
        <div className="absolute bottom-0 left-0 w-full p-4 pt-10 bg-gradient-to-t from-black/80 to-transparent z-10">
          <div className="flex items-center gap-1 mb-1">
            <p className="text-white font-semibold text-sm">{post.creatorName}</p>
            {post.verified && <VerifiedBadge size={14} />}
          </div>
          <p className="text-white/90 text-sm leading-snug">{post.caption}</p>
          {post.hashtags && (
            <p className="text-white/70 text-xs mt-1">{post.hashtags.map((h) => `#${h}`).join(' ')}</p>
          )}
        </div>

        {showComments && (
          <CommentSheet
            postId={post.id}
            initialComments={mockComments[post.id] ?? []}
            onClose={() => setShowComments(false)}
          />
        )}
      </div>

      {/* Right action column */}
      <div className="flex flex-col items-center justify-end gap-5 pb-6 w-14 shrink-0">
        <div className="relative mb-2">
          <div className="h-10 w-10 rounded-full bg-white/[0.08] flex items-center justify-center text-lg">
            {post.avatar}
          </div>
          <button
            onClick={() => requireAuth(() => showToast('Followed creator', 'success'))}
            className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-4 w-4 rounded-full brand-gradient text-primary-foreground flex items-center justify-center"
          >
            <FontAwesomeIcon icon={faPlus} className="h-2 w-2" />
          </button>
        </div>

        <button onClick={() => handleLike()} className="flex flex-col items-center gap-1">
          <FontAwesomeIcon
            icon={faHeart}
            className="h-6 w-6"
            style={{ color: liked ? '#ef4444' : 'var(--muted-foreground)' }}
          />
          <span className="text-xs text-muted-foreground">{formatCount(likeCount)}</span>
        </button>

        <button
          onClick={() => requireAuth(() => setShowComments(true))}
          className="flex flex-col items-center gap-1"
        >
          <FontAwesomeIcon icon={faComment} className="h-6 w-6 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{formatCount(post.comments)}</span>
        </button>

        <button onClick={handleBookmark} className="flex flex-col items-center gap-1">
          <FontAwesomeIcon
            icon={faBookmark}
            className="h-6 w-6"
            style={{ color: bookmarked ? 'var(--secondary)' : 'var(--muted-foreground)' }}
          />
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <FontAwesomeIcon icon={faShare} className="h-6 w-6 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}