'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth, useToast } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';
import { postsApi } from '@/lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faVideo } from '@fortawesome/free-solid-svg-icons';
import { X, Loader2, ChevronDown, Check } from 'lucide-react';

const MAX_FILES = 4;
const MAX_FILE_BYTES = 50 * 1024 * 1024;

interface Attachment {
  file: File;
  previewUrl: string;
  isVideo: boolean;
}

function UploadForm() {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { requireAuth } = useRequireAuth();
  const { user } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { mode, realm } = useProfileSwitch();

  // Which identity the post goes out as. Defaults to the realm when the user is
  // already switched into their creator profile, or when linked with ?as=realm.
  const [postAsRealm, setPostAsRealm] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  const identityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!realm) {
      setPostAsRealm(false);
      return;
    }
    setPostAsRealm(mode === 'creator' || searchParams.get('as') === 'realm');
  }, [realm, mode, searchParams]);

  useEffect(() => {
    if (!identityOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!identityRef.current?.contains(e.target as Node)) setIdentityOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIdentityOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [identityOpen]);

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  const asRealm = postAsRealm && Boolean(realm);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const incoming = Array.from(fileList);
    const room = MAX_FILES - attachments.length;

    if (room <= 0) {
      addToast({ message: `You can attach up to ${MAX_FILES} files.`, type: 'error', duration: 4000 });
      return;
    }

    const accepted: Attachment[] = [];
    for (const file of incoming.slice(0, room)) {
      if (file.size > MAX_FILE_BYTES) {
        addToast({
          message: `${file.name} is over the 50MB limit.`,
          type: 'error',
          duration: 4000,
        });
        continue;
      }
      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo: file.type.startsWith('video/'),
      });
    }

    if (incoming.length > room) {
      addToast({ message: `Only the first ${room} file(s) were added.`, type: 'info', duration: 4000 });
    }

    setAttachments((prev) => [...prev, ...accepted]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      // Revoke the blob URL we created, or the page leaks it until reload.
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePost = () => {
    requireAuth(async () => {
      if (!content.trim() && attachments.length === 0) {
        addToast({ message: 'Write something or attach media first.', type: 'error', duration: 4000 });
        return;
      }

      setIsSubmitting(true);
      try {
        await postsApi.create(
          content,
          attachments.map((a) => a.file),
          asRealm ? realm?.id : null,
        );

        attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
        setContent('');
        setAttachments([]);
        addToast({ message: 'Post published!', type: 'success', duration: 4000 });
        router.push('/app/for-you');
      } catch (err) {
        addToast({
          message: err instanceof Error ? err.message : 'Could not publish your post.',
          type: 'error',
          duration: 5000,
        });
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const clearAll = () => {
    attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    setContent('');
    setAttachments([]);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-foreground mb-8">Create Post</h1>

      {/* Upload Card */}
      <div className="glass-card rounded-2xl p-6 mb-6">
        {/* Posting identity. With a realm, this is a picker — it decides whether
            the post is credited to the person or to the page. */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
          <div
            className={`w-10 h-10 flex items-center justify-center text-sm font-bold text-white overflow-hidden flex-shrink-0 ${
              asRealm
                ? 'rounded-xl brand-gradient'
                : 'rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500'
            }`}
          >
            {asRealm ? (
              realm?.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                (realm?.name.charAt(0).toUpperCase() ?? '?')
              )
            ) : user?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-semibold text-card-foreground truncate">
              {asRealm ? realm?.name : (user?.displayName ?? 'Your Profile')}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {asRealm
                ? `Posting as your realm · @${realm?.slug}`
                : user
                  ? `@${user.username}`
                  : 'Sign in to post'}
            </p>
          </div>

          {realm && (
            <div className="relative flex-shrink-0" ref={identityRef}>
              <button
                type="button"
                onClick={() => setIdentityOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={identityOpen}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium glass-chip text-foreground hover:brightness-110 transition"
              >
                Post as
                <ChevronDown size={13} className="text-muted-foreground" />
              </button>

              {identityOpen && (
                <div
                  role="listbox"
                  className="absolute right-0 top-10 z-30 w-56 glass-card rounded-xl py-1 shadow-2xl"
                >
                  <IdentityOption
                    label={user?.displayName ?? 'Your profile'}
                    sub={`@${user?.username ?? ''}`}
                    selected={!asRealm}
                    onClick={() => {
                      setPostAsRealm(false);
                      setIdentityOpen(false);
                    }}
                  />
                  <IdentityOption
                    label={realm.name}
                    sub={`@${realm.slug} · realm`}
                    selected={asRealm}
                    onClick={() => {
                      setPostAsRealm(true);
                      setIdentityOpen(false);
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content Input */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's new with your signal?"
          maxLength={5000}
          className="w-full glass-input rounded-xl p-4 text-card-foreground placeholder-muted-foreground resize-none"
          rows={6}
        />
        <p className="text-right text-xs text-muted-foreground mt-1">{content.length}/5000</p>

        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
            {attachments.map((a, i) => (
              <div
                key={a.previewUrl}
                className="relative aspect-square rounded-lg overflow-hidden border border-border bg-black/40"
              >
                {a.isVideo ? (
                  <video src={a.previewUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={a.previewUrl} alt="" className="w-full h-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Media Options */}
        <div className="flex gap-3 my-6 py-4 border-y border-border">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
          >
            <FontAwesomeIcon icon={faImage} className="h-4 w-4" />
            Image
          </button>
          <button
            type="button"
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition"
          >
            <FontAwesomeIcon icon={faVideo} className="h-4 w-4" />
            Video
          </button>
          <span className="ml-auto self-center text-xs text-muted-foreground">
            {attachments.length}/{MAX_FILES} files
          </span>
        </div>

        {/* Post Button */}
        <div className="flex justify-end gap-3">
          <button
            onClick={clearAll}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg glass-chip text-foreground hover:brightness-125 transition font-medium disabled:opacity-50"
          >
            Clear
          </button>
          <button
            onClick={handlePost}
            disabled={isSubmitting}
            className="px-6 py-2 rounded-lg brand-gradient text-primary-foreground hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center gap-2"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            {isSubmitting ? 'Publishing...' : 'Publish Post'}
          </button>
        </div>
      </div>

      {/* Tips */}
      <div className="glass-card rounded-2xl p-4 space-y-2">
        <p className="font-semibold text-card-foreground">Tips for a great post:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Share valuable insights about your signals</li>
          <li>Engage with your community</li>
          <li>Use relevant hashtags #signals #trading</li>
          <li>Post regularly to maintain engagement</li>
        </ul>
      </div>
    </div>
  );
}

// `useSearchParams` opts the tree out of prerendering unless it sits under a
// Suspense boundary, so the form is split out from the route component.
export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="p-4 lg:p-6 max-w-2xl mx-auto">
          <div className="glass-card rounded-2xl h-64 animate-pulse" />
        </div>
      }
    >
      <UploadForm />
    </Suspense>
  );
}

const IdentityOption = ({
  label,
  sub,
  selected,
  onClick,
}: {
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    role="option"
    aria-selected={selected}
    onClick={onClick}
    className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-sidebar-accent transition"
  >
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-foreground truncate">{label}</span>
      <span className="block text-xs text-muted-foreground truncate">{sub}</span>
    </span>
    {selected && <Check size={14} className="text-primary flex-shrink-0" />}
  </button>
);
