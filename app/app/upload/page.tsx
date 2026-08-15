'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth, usePostUpload, useToast } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';
import {
  postsApi,
  REALM_CATEGORIES,
  REALM_CATEGORY_LABELS,
  type RealmCategory,
} from '@/lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faVideo } from '@fortawesome/free-solid-svg-icons';
import { X, Loader2, ChevronDown, Check, Crop } from 'lucide-react';
import { MediaComposer } from '@/components/upload/MediaComposer';
import type { AspectRatio } from '@/components/upload/mediaEditing';

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
  // Progress lives in the store, not here: the publish outlives this page.
  const {
    status: uploadStatus,
    start: startUpload,
    setPercent: setUploadPercent,
    succeed: uploadSucceeded,
    fail: uploadFailed,
  } = usePostUpload();
  const isSubmitting = uploadStatus === 'uploading' || uploadStatus === 'processing';
  // Files waiting to be framed and edited. Non-null while the composer is open;
  // nothing is attached to the post until it returns.
  const [composing, setComposing] = useState<{ files: File[]; isVideo: boolean } | null>(null);
  // The post's topic. Defaults to the author's realm category when they have
  // one, and is what makes a post findable under a category on Explore.
  const [category, setCategory] = useState<RealmCategory | null>(null);
  // Whether the author has touched the selector. Once they have, the realm
  // default must stop overwriting their choice.
  const categoryTouched = useRef(false);
  // Framing chosen in the composer, sent alongside the post.
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('ORIGINAL');
  const [cover, setCover] = useState<File | null>(null);
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

  // Pre-fill the topic from the author's realm once it loads — but never over an
  // explicit choice, so switching identity can't silently rewrite their answer.
  useEffect(() => {
    if (categoryTouched.current) return;
    setCategory(realm?.category ?? null);
  }, [realm?.category]);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;

    const incoming = Array.from(fileList);
    const room = MAX_FILES - attachments.length;

    if (room <= 0) {
      addToast({ message: `You can attach up to ${MAX_FILES} files.`, type: 'error', duration: 4000 });
      return;
    }

    const accepted: File[] = [];
    for (const file of incoming.slice(0, room)) {
      if (file.size > MAX_FILE_BYTES) {
        addToast({
          message: `${file.name} is over the 50MB limit.`,
          type: 'error',
          duration: 4000,
        });
        continue;
      }
      accepted.push(file);
    }

    if (!accepted.length) return;

    if (incoming.length > room) {
      addToast({ message: `Only the first ${room} file(s) were added.`, type: 'info', duration: 4000 });
    }

    // Straight into the composer: framing and editing happen before anything is
    // attached, so what sits in the form is already what will be posted.
    setComposing({
      files: accepted,
      isVideo: accepted.some((file) => file.type.startsWith('video/')),
    });
  };

  /** The composer hands back processed files plus the framing it chose. */
  const handleComposed = (result: {
    files: File[];
    aspectRatio: AspectRatio;
    cover?: File;
  }) => {
    setAttachments((prev) => [
      ...prev,
      ...result.files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        isVideo: file.type.startsWith('video/'),
      })),
    ]);
    setAspectRatio(result.aspectRatio);
    setCover(result.cover ?? null);
    setComposing(null);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      // Revoke the blob URL we created, or the page leaks it until reload.
      URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handlePost = () => {
    requireAuth(() => {
      if (!content.trim() && attachments.length === 0) {
        addToast({ message: 'Write something or attach media first.', type: 'error', duration: 4000 });
        return;
      }

      // Captured before the form is cleared, so a retry republishes exactly what
      // was composed rather than whatever the emptied form now holds.
      const payload = {
        body: content,
        files: attachments.map((a) => a.file),
        realmId: asRealm ? realm?.id ?? null : null,
        aspectRatio,
        cover: cover ?? undefined,
        category,
      };

      const publish = () => {
        startUpload(publish);

        postsApi
          .create(payload.body, payload.files, payload.realmId, {
            onProgress: setUploadPercent,
            aspectRatio: payload.aspectRatio,
            cover: payload.cover,
            category: payload.category,
          })
          .then(() => uploadSucceeded())
          .catch((err) => {
            uploadFailed(
              err instanceof Error ? err.message : 'Could not publish your post.',
            );
          });
      };

      publish();

      // Clear and leave immediately, without waiting for the request. The bar in
      // the layout owns the rest, so the composer is gone the moment Post is
      // pressed rather than sitting there for the length of a video upload.
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setContent('');
      setAttachments([]);
      setAspectRatio('ORIGINAL');
      setCover(null);
      setCategory(realm?.category ?? null);
      router.push('/app/for-you');
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
          <span className="ml-auto self-center flex items-center gap-3 text-xs text-muted-foreground">
            {attachments.length > 0 && (
              <span className="flex items-center gap-1">
                <Crop size={11} />
                {aspectRatio === 'ORIGINAL' ? 'Original' : aspectRatio}
                {cover && ' · cover set'}
              </span>
            )}
            {attachments.length}/{MAX_FILES} files
          </span>
        </div>

        {/* Topic. Without one a post can never be found under a category on
            Explore, which is why it defaults to the author's realm rather than
            to nothing. */}
        <div>
          <label htmlFor="post-category" className="block text-sm font-medium text-foreground mb-1.5">
            Topic
          </label>
          <select
            id="post-category"
            value={category ?? ''}
            onChange={(e) => {
              categoryTouched.current = true;
              setCategory((e.target.value || null) as RealmCategory | null);
            }}
            className="w-full sm:w-64 px-3 py-2 rounded-lg glass-input text-sm text-foreground
              focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">No topic</option>
            {REALM_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {REALM_CATEGORY_LABELS[option]}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {category
              ? 'People browsing this topic on Explore will find this post.'
              : 'Without a topic this post won’t appear under any category on Explore.'}
          </p>
        </div>

        {/* Progress and failure are reported by the bar pinned to the top of the
            app, since the publish keeps running after this page is left. */}

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

      {composing && (
        <MediaComposer
          files={composing.files}
          isVideo={composing.isVideo}
          onCancel={() => setComposing(null)}
          onDone={handleComposed}
        />
      )}

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
