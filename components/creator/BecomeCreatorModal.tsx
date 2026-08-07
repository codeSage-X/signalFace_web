'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, ChevronLeft, Loader2, Sparkles, TrendingUp, Users, X } from 'lucide-react';
import { useAuth, useProfileMode, useToast } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';
import {
  ApiError,
  REALM_CATEGORIES,
  REALM_CATEGORY_LABELS,
  realmsApi,
  type RealmCategory,
} from '@/lib/api';
import { createRealmSchema, type CreateRealmInput } from '@/lib/schemas';

const CATEGORY_OPTIONS = REALM_CATEGORIES.map((value) => ({
  value,
  label: REALM_CATEGORY_LABELS[value],
}));

/** What creating a realm unlocks — shown on the intro step. */
const PERKS = [
  {
    icon: TrendingUp,
    title: 'Your own tradable Signal',
    body: 'Fans buy into you. Your Signal price tracks how your realm grows.',
  },
  {
    icon: Users,
    title: 'A page fans can follow',
    body: 'Your realm gets its own name, handle, avatar and cover — separate from your personal profile.',
  },
  {
    icon: Sparkles,
    title: 'A creator dashboard',
    body: 'Holders, volume, price history and your top supporters, all in one place.',
  },
];

/** Turns "Ada's Music Room" into "ada_s_music_room" for the handle preview. */
function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

type Step = 'intro' | 'details';

export const BecomeCreatorModal = ({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) => {
  const { user, updateUser } = useAuth();
  const setRealm = useProfileMode((s) => s.setRealm);
  const { switchTo } = useProfileSwitch();
  const { addToast } = useToast();
  const [step, setStep] = useState<Step>('intro');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateRealmInput>({
    resolver: zodResolver(createRealmSchema),
    defaultValues: {
      name: '',
      category: '',
      slug: '',
      tagline: '',
      description: '',
      websiteUrl: '',
    },
  });

  const name = watch('name');
  const slug = watch('slug');
  const handlePreview = useMemo(() => slug || slugify(name || '') || 'your_realm', [slug, name]);

  // Reopening should always start clean rather than resume a half-filled form.
  useEffect(() => {
    if (!open) {
      setStep('intro');
      reset();
    }
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const onSubmit = async (values: CreateRealmInput) => {
    setSubmitting(true);
    try {
      const realm = await realmsApi.create({
        name: values.name.trim(),
        category: values.category as RealmCategory,
        ...(values.slug ? { slug: values.slug } : {}),
        ...(values.tagline ? { tagline: values.tagline.trim() } : {}),
        ...(values.description ? { description: values.description.trim() } : {}),
        ...(values.websiteUrl ? { websiteUrl: values.websiteUrl.trim() } : {}),
      });

      setRealm(realm);
      // The account is a creator account now — reflect it without a refetch so
      // creator-only surfaces unlock immediately.
      updateUser({ role: 'CREATOR', creatorStatus: 'APPROVED' });

      addToast({
        message: `${realm.name} is live. Welcome to the creator side.`,
        type: 'success',
        duration: 4000,
      });

      onClose();
      // Drop them straight into the page they just created.
      switchTo('creator');
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not create your realm.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={() => !submitting && onClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Become a creator"
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto glass-card rounded-2xl shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-4 bg-[#12101A]/92 backdrop-blur-xl border-b border-white/[0.06]">
          {step === 'details' && (
            <button
              type="button"
              onClick={() => setStep('intro')}
              aria-label="Back"
              className="text-muted-foreground hover:text-foreground transition"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground truncate">
              {step === 'intro' ? 'Become a creator' : 'Create your realm'}
            </h2>
            <p className="text-xs text-muted-foreground">
              {step === 'intro' ? 'Turn your account into a creator account' : 'Step 2 of 2'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !submitting && onClose()}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground transition"
          >
            <X size={20} />
          </button>
        </div>

        {step === 'intro' ? (
          <div className="p-6 space-y-5">
            <div className="flex items-center gap-3 p-4 rounded-xl glass-brand">
              <span className="w-11 h-11 rounded-full brand-gradient flex items-center justify-center flex-shrink-0">
                <BadgeCheck size={20} className="text-white" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  A realm is your creator page
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Like a Facebook Page or an Instagram business profile — it lives alongside
                  your personal profile, and you switch between them.
                </p>
              </div>
            </div>

            <ul className="space-y-4">
              {PERKS.map((perk) => (
                <li key={perk.title} className="flex gap-3">
                  <span className="w-8 h-8 rounded-lg bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                    <perk.icon size={15} className="text-primary" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{perk.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{perk.body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-xs text-muted-foreground">
              You&apos;ll still keep{' '}
              <span className="text-foreground font-medium">@{user?.username ?? 'your'}</span> as
              your personal fan profile.
            </p>

            <button
              type="button"
              onClick={() => setStep('details')}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm brand-gradient brand-glow hover:brightness-110 transition"
            >
              Get started
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
            <Field label="Realm name" required error={errors.name?.message}>
              <input
                {...register('name')}
                placeholder="e.g. Ada's Music Room"
                className={inputClass}
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                This is the name fans see on your posts. Your page will live at{' '}
                <span className="text-primary font-medium">/app/r/{handlePreview}</span>
              </p>
            </Field>

            <Field label="Category" required error={errors.category?.message}>
              <select {...register('category')} className={inputClass} defaultValue="">
                <option value="" disabled>
                  What is your realm about?
                </option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-card text-foreground">
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Handle"
              error={errors.slug?.message}
              hint="Optional — we'll build one from your name"
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm flex-shrink-0">@</span>
                <input {...register('slug')} placeholder={slugify(name || '')} className={inputClass} />
              </div>
            </Field>

            <Field label="Tagline" error={errors.tagline?.message} hint="Optional">
              <input
                {...register('tagline')}
                placeholder="One line on what you make"
                className={inputClass}
              />
            </Field>

            <Field label="About" error={errors.description?.message} hint="Optional">
              <textarea
                {...register('description')}
                rows={3}
                placeholder="Tell fans what your realm is about..."
                className={`${inputClass} resize-none`}
              />
            </Field>

            <Field label="Website" error={errors.websiteUrl?.message} hint="Optional">
              <input
                {...register('websiteUrl')}
                placeholder="https://yoursite.com"
                className={inputClass}
              />
            </Field>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Creating your realm mints your tradable Signal and switches your account to a
              creator account. You can add an avatar and cover art once your page is live.
            </p>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white text-sm brand-gradient brand-glow hover:brightness-110 transition disabled:opacity-70"
            >
              {submitting && <Loader2 size={15} className="animate-spin" />}
              {submitting ? 'Creating your realm…' : 'Create realm'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

const inputClass =
  'w-full px-4 py-3 glass-input rounded-xl text-foreground placeholder-muted-foreground text-sm';

const Field = ({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </div>
    {children}
    {error && <p className="text-destructive text-xs mt-1">{error}</p>}
  </div>
);
