import type { PostMediaItem } from './api';
import { mediaAttachmentUrl } from './post-sharing';

function extensionFor(blob: Blob, item: PostMediaItem) {
  if (blob.type.includes('webm')) return 'webm';
  if (blob.type.includes('quicktime')) return 'mov';
  if (blob.type.includes('png')) return 'png';
  if (blob.type.includes('webp')) return 'webp';
  if (blob.type.includes('gif')) return 'gif';
  if (blob.type.includes('jpeg')) return 'jpg';
  return item.kind === 'video' ? 'mp4' : 'jpg';
}

function clickDownload(href: string, filename: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/** Downloads one image or video after the API has exposed the author's opt-in. */
export async function downloadPostMedia(item: PostMediaItem, filename: string) {
  const attachment = mediaAttachmentUrl(item.url, filename, item.kind);
  if (attachment) {
    clickDownload(attachment, filename);
    return;
  }

  const response = await fetch(item.url);
  if (!response.ok) throw new Error('Download failed. Please try again.');

  const blob = await response.blob();
  if (!blob.type.startsWith(`${item.kind}/`)) {
    throw new Error(`This ${item.kind} cannot be downloaded right now.`);
  }

  const objectUrl = URL.createObjectURL(blob);
  clickDownload(objectUrl, `${filename}.${extensionFor(blob, item)}`);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
