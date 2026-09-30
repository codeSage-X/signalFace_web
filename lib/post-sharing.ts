import type { FeedPost } from './api';

export interface ShareablePost {
  id: string;
  title: string;
  text: string;
  path: string;
  thumbnail?: string | null;
  videos: string[];
}

export function shareablePost(post: FeedPost): ShareablePost {
  const visible = post.moderation === 'VISIBLE';
  return {
    id: post.id,
    title: `${post.realm?.name ?? `@${post.author.username}`} on Signal Face`,
    text: visible ? post.body ?? '' : 'View this post on Signal Face',
    path: `/app/for-you?post=${encodeURIComponent(post.id)}`,
    thumbnail: visible ? post.coverUrl ?? (post.kind === 'image' ? post.mediaUrls[0] : null) : null,
    videos: visible && post.allowDownload
      ? post.media?.length ? post.media.filter((item) => item.kind === 'video').map((item) => item.url)
        : post.kind === 'video' ? post.mediaUrls : []
      : [],
  };
}

export function postShareUrl(origin: string, post: ShareablePost) {
  return new URL(post.path, origin).href;
}

export function externalShareLinks(url: string, title: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  };
}

export function sharedPostMessage(post: ShareablePost, url: string, note = '') {
  return [note.trim().slice(0, 1000), post.title.slice(0, 160), post.text.trim().slice(0, 240), url].filter(Boolean).join('\n\n');
}

/** Cloudinary can stream an attachment without buffering the video in memory. */
export function videoAttachmentUrl(src: string, filename: string): string | null {
  return mediaAttachmentUrl(src, filename, 'video');
}

/** Cloudinary can stream either supported media type as an attachment. */
export function mediaAttachmentUrl(
  src: string,
  filename: string,
  kind: 'image' | 'video',
): string | null {
  try {
    const url = new URL(src);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' || url.username || url.password || url.port) return null;
    if (!new RegExp(`^/[^/]+/${kind}/upload/`).test(url.pathname) || /\/s--[^/]+--\//.test(url.pathname)) return null;
    const safeName = filename.replace(/[^a-zA-Z0-9_-]/g, '-');
    url.pathname = url.pathname.replace(`/${kind}/upload/`, `/${kind}/upload/fl_attachment:${safeName}/`);
    return url.href;
  } catch { return null; }
}
