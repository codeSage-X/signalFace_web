'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Copy, Download, Loader2, MessageCircle, Search, Send, Share2, X } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { usersApi, type FollowPerson } from '@/lib/api';
import { useAuth } from '@/lib/stores';
import { externalShareLinks, postShareUrl, sharedPostMessage, videoAttachmentUrl, type ShareablePost } from '@/lib/post-sharing';
import { sendSharedPost } from '@/lib/send-shared-post';

export function PostShareModal({
  post,
  onClose,
  showDownload = true,
}: {
  post: ShareablePost;
  onClose: () => void;
  showDownload?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { user, isAuthenticated, setAuthModalOpen } = useAuth();
  const [friends, setFriends] = useState<FollowPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [friendsError, setFriendsError] = useState('');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [videoIndex, setVideoIndex] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [instagramReady, setInstagramReady] = useState(false);
  const [url, setUrl] = useState('');
  const pending = useRef(false);
  const downloadAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    setUrl(postShareUrl(window.location.origin, post));
    dialog.current?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; downloadAbort.current?.abort(); };
  }, [post.path]);

  useEffect(() => {
    let cancelled = false;
    setFriends([]); setSelected(new Set()); setSent(new Set()); setFriendsError('');
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      try {
        let cursor: string | null = null;
        do {
          const page = await usersApi.followers(cursor, 50);
          if (cancelled) return;
          // Followers who are also followed by the viewer are mutual friends.
          const mutual = page.items.filter((person) => person.isFollowedByMe && person.id !== user?.id);
          setFriends((previous) => {
            const people = new Map(previous.map((person) => [person.id, person]));
            mutual.forEach((person) => people.set(person.id, person));
            return Array.from(people.values());
          });
          cursor = page.nextCursor;
        } while (cursor);
      } catch (err) { if (!cancelled) setFriendsError(err instanceof Error ? err.message : 'Could not load friends.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, retry]);

  async function copy(forInstagram = false) {
    setError(''); setStatus('');
    try {
      await navigator.clipboard.writeText(url);
      setInstagramReady(forInstagram);
      setStatus(forInstagram ? 'Link copied. Open Instagram and paste it into a DM.' : 'Link copied to clipboard.');
    } catch { setError('Could not copy automatically. Select and copy the link below.'); }
  }

  async function send() {
    if (pending.current || !selected.size || !url) return;
    pending.current = true; setSending(true); setStatus(''); setError('');
    const failed = new Set<string>();
    const completed = new Set<string>();
    try {
      const text = sharedPostMessage(post, url, note);
      for (const id of selected) {
        try { await sendSharedPost(id, text); completed.add(id); }
        catch { failed.add(id); }
      }
      setSent((previous) => new Set([...previous, ...completed]));
      setSelected(failed);
      if (completed.size) setStatus(`Sent to ${completed.size} friend${completed.size === 1 ? '' : 's'}.`);
      if (failed.size) setError(`Could not send to ${failed.size} friend${failed.size === 1 ? '' : 's'}. They remain selected so you can retry.`);
    } finally { pending.current = false; setSending(false); }
  }

  async function download() {
    const src = post.videos[videoIndex];
    if (!src || downloading) return;
    setError(''); setStatus(''); setDownloading(true);
    const filename = `signalface-${post.id}-${videoIndex + 1}`;
    const attachment = videoAttachmentUrl(src, filename);
    try {
      if (attachment) {
        const link = document.createElement('a');
        link.href = attachment; link.download = filename; link.target = '_blank'; link.rel = 'noopener noreferrer';
        dialog.current?.appendChild(link); link.click(); link.remove();
      } else {
        const controller = new AbortController(); downloadAbort.current = controller;
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok) throw new Error('Download failed. Please try again.');
        const blob = await response.blob();
        if (!blob.type.startsWith('video/')) throw new Error('This video cannot be downloaded right now.');
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl; link.download = `${filename}.${blob.type.includes('webm') ? 'webm' : blob.type.includes('quicktime') ? 'mov' : 'mp4'}`;
        dialog.current?.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      }
      setStatus('Video download started.');
    } catch (err) { if (!(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error ? err.message : 'Could not download this video.'); }
    finally { setDownloading(false); }
  }

  const term = search.trim().toLowerCase();
  const visible = friends.filter((friend) => `${friend.displayName} ${friend.username}`.toLowerCase().includes(term));
  const links = externalShareLinks(url, post.title);
  const actionClass = 'flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-3 text-xs font-medium hover:bg-muted disabled:opacity-50';
  return (
    <dialog ref={dialog} aria-labelledby="post-share-title" onKeyDown={(event) => event.stopPropagation()}
      onCancel={(event) => { event.preventDefault(); if (!sending) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !sending) onClose(); }}
      className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[90dvh] w-full max-w-none overflow-hidden rounded-t-3xl border border-border bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/60 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-lg sm:rounded-2xl"
    >
      <div className="flex max-h-[90dvh] flex-col pb-[env(safe-area-inset-bottom)]">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4"><h2 id="post-share-title" className="text-lg font-bold">Share post</h2><button type="button" disabled={sending} onClick={onClose} aria-label="Close share menu" className="rounded-full p-2 hover:bg-muted"><X size={20} /></button></header>
        <div className="min-h-0 overflow-y-auto px-5 pb-4">
          <div className="my-4 flex items-center gap-3 rounded-xl bg-muted/60 p-3">
            {post.thumbnail ? <img src={post.thumbnail} alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" /> : <Share2 size={24} className="shrink-0 text-primary" />}
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{post.title}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{post.text || 'Share this post with your friends'}</p></div>
          </div>
          <h3 className="text-sm font-semibold">Send to friends</h3>
          {!isAuthenticated ? <button type="button" onClick={() => { onClose(); setAuthModalOpen(true); }} className="my-4 text-sm font-semibold text-primary">Sign in to share in DMs</button> : <>
            <div className="relative mt-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search friends" placeholder="Search friends" value={search} onChange={(event) => setSearch(event.target.value)} className="glass-input w-full rounded-xl py-2.5 pl-9 pr-3 text-sm" /></div>
            {friendsError && <p role="alert" className="mt-3 text-sm text-destructive">{friendsError} <button onClick={() => setRetry((value) => value + 1)} disabled={sending} className="underline">Retry</button></p>}
            <div className="my-3 grid max-h-44 grid-cols-4 gap-2 overflow-y-auto">
              {visible.map((friend) => <button type="button" key={friend.id} disabled={sending || sent.has(friend.id)} aria-pressed={selected.has(friend.id)} aria-label={`${sent.has(friend.id) ? 'Sent to' : 'Select'} ${friend.displayName}`} onClick={() => setSelected((previous) => { const next = new Set(previous); if (next.has(friend.id)) next.delete(friend.id); else next.add(friend.id); return next; })} className={`flex min-w-0 flex-col items-center gap-1 rounded-xl p-2 ${selected.has(friend.id) ? 'bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted'} disabled:opacity-60`}>
                <span className="relative"><UserAvatar src={friend.avatarUrl} name={friend.displayName} size="md" ring={false} />{(selected.has(friend.id) || sent.has(friend.id)) && <span className="absolute -bottom-1 -right-1 rounded-full bg-primary p-1 text-white"><Check size={11} /></span>}</span>
                <span className="w-full truncate text-center text-xs">{friend.displayName}</span>{sent.has(friend.id) && <span className="text-[10px] text-primary">Sent</span>}
              </button>)}
            </div>
            {loading && <p role="status" className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 size={14} className="animate-spin" /> Loading friends…</p>}
            {!loading && !friendsError && !visible.length && <p className="my-4 text-sm text-muted-foreground">{term ? 'No friends match this search.' : 'Friends who follow you back will appear here.'}</p>}
            {selected.size > 0 && <textarea aria-label="Message to friends" value={note} onChange={(event) => setNote(event.target.value)} disabled={sending} maxLength={1000} rows={2} placeholder="Add a message (optional)" className="glass-input mb-3 w-full resize-none rounded-xl p-3 text-sm" />}
            <button type="button" onClick={send} disabled={!selected.size || sending || !url} className="brand-gradient mb-4 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-40">{sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {sending ? 'Sending…' : `Send${selected.size ? ` (${selected.size})` : ''}`}</button>
          </>}
          <div className="grid grid-cols-4 gap-1 border-t border-border pt-2">
            <button type="button" disabled={!url} onClick={() => void copy()} className={actionClass}><span className="rounded-full bg-muted p-3"><Copy size={21} /></span>Copy link</button>
            <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" className={actionClass}><span className="rounded-full bg-[#25D366] p-3 text-white"><MessageCircle size={21} /></span>WhatsApp</a>
            <a href={links.facebook} target="_blank" rel="noopener noreferrer" className={actionClass}><span className="rounded-full bg-[#1877F2] p-3 text-white"><span aria-hidden="true" className="flex h-[21px] w-[21px] items-center justify-center text-2xl font-bold leading-none">f</span></span>Facebook</a>
            <button type="button" disabled={!url} onClick={() => void copy(true)} className={actionClass}><span className="rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 p-3 text-white"><Camera size={21} /></span>Instagram</button>
          </div>
          {instagramReady && <a href="https://www.instagram.com/direct/inbox/" target="_blank" rel="noopener noreferrer" className="mt-2 block text-center text-sm font-semibold text-primary underline">Open Instagram to paste your link</a>}
          {showDownload && !!post.videos.length && <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            {post.videos.length > 1 && <select aria-label="Video to download" value={videoIndex} onChange={(event) => setVideoIndex(Number(event.target.value))} disabled={downloading} className="glass-input min-w-0 rounded-xl p-2 text-sm">{post.videos.map((_, index) => <option key={index} value={index}>Video {index + 1}</option>)}</select>}
            <button type="button" onClick={download} disabled={downloading} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-muted px-3 py-3 text-sm font-semibold disabled:opacity-50">{downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} {downloading ? 'Downloading…' : 'Download video'}</button>
          </div>}
          {status && <p role="status" className="mt-3 text-sm text-primary">{status}</p>}
          {error && <div role="alert" className="mt-3 text-sm text-destructive"><p>{error}</p><input readOnly aria-label="Post link" value={url} onFocus={(event) => event.target.select()} className="glass-input mt-2 w-full rounded-lg p-2 text-xs text-foreground" /></div>}
        </div>
      </div>
    </dialog>
  );
}
