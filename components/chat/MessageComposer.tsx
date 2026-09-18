'use client';

import { FormEvent, useRef, useState } from 'react';
import { ImagePlus, Laugh, Loader2, Send, Sticker, Video } from 'lucide-react';
import { chatMediaApi, type ChatMediaUpload } from '@/lib/api';

const EMOJIS = ['😀', '😂', '😍', '🥰', '😎', '😭', '👏', '🙌', '❤️', '🔥', '🎉', '👍'];
const MAX_INPUT_HEIGHT_PX = 120;

export function MessageComposer({
  placeholder,
  sending,
  onSend,
}: {
  placeholder: string;
  sending: boolean;
  onSend: (text: string, media?: ChatMediaUpload) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const gifInputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending || uploading) return;
    setDraft('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    try {
      await onSend(body);
    } catch {
      setDraft(body);
    }
  };

  const attach = async (file?: File) => {
    if (!file || sending || uploading) return;
    setError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      const media = await chatMediaApi.upload(file, { onProgress: setUploadProgress });
      await onSend(draft.trim(), media);
      setDraft('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that media.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
      if (videoInputRef.current) videoInputRef.current.value = '';
      if (gifInputRef.current) gifInputRef.current.value = '';
    }
  };

  return (
    <div className="relative border-t border-white/10 flex-shrink-0">
      {emojiOpen && (
        <div className="absolute bottom-full left-3 mb-2 grid grid-cols-6 gap-1 p-2 glass-card shadow-xl">
          {EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => { setDraft((value) => value + emoji); inputRef.current?.focus(); }} className="w-9 h-9 text-xl hover:bg-white/10" aria-label={`Insert ${emoji}`}>
              {emoji}
            </button>
          ))}
        </div>
      )}
      {error && <p className="px-3 pt-2 text-xs text-red-400">{error}</p>}
      {uploading && <p className="px-3 pt-2 text-xs text-muted-foreground">Uploading media{uploadProgress ? ` ${uploadProgress}%` : '...'}</p>}
      <form onSubmit={submit} className="flex items-end gap-1.5 p-3">
        <input ref={mediaInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void attach(event.target.files?.[0])} />
        <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="hidden" onChange={(event) => void attach(event.target.files?.[0])} />
        <input ref={gifInputRef} type="file" accept="image/gif" className="hidden" onChange={(event) => void attach(event.target.files?.[0])} />
        <button type="button" title="Share photo" aria-label="Share photo" onClick={() => mediaInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground" disabled={uploading}><ImagePlus size={19} /></button>
        <button type="button" title="Share video" aria-label="Share video" onClick={() => videoInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground" disabled={uploading}><Video size={19} /></button>
        <button type="button" title="Share GIF" aria-label="Share GIF" onClick={() => gifInputRef.current?.click()} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground" disabled={uploading}><Sticker size={19} /></button>
        <button type="button" title="Add emoji" aria-label="Add emoji" onClick={() => setEmojiOpen((open) => !open)} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-foreground"><Laugh size={19} /></button>
        <textarea ref={inputRef} rows={1} value={draft} onChange={(event) => { setDraft(event.target.value); event.target.style.height = 'auto'; event.target.style.height = `${Math.min(event.target.scrollHeight, MAX_INPUT_HEIGHT_PX)}px`; }} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(event); } }} placeholder={placeholder} maxLength={4000} className="flex-1 min-w-0 resize-none px-3.5 py-2.5 rounded-lg glass-input text-sm text-foreground placeholder-muted-foreground" style={{ maxHeight: MAX_INPUT_HEIGHT_PX }} />
        <button type="submit" disabled={!draft.trim() || sending || uploading} title="Send" aria-label="Send" className="w-10 h-10 rounded-full brand-gradient flex items-center justify-center text-white disabled:opacity-40">
          {sending || uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );
}
