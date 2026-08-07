'use client';

import { useAuth, useProfileMode } from '@/lib/stores';

/**
 * The full-screen "Switching…" splash, in the mould of Facebook's page switcher:
 * it names the identity you are moving into and covers the route change so the
 * two profiles never appear half-swapped.
 */
export const ProfileSwitchOverlay = () => {
  const { switchingTo, realm } = useProfileMode();
  const { user } = useAuth();

  if (!switchingTo) return null;

  const toCreator = switchingTo === 'creator';
  const name = toCreator ? (realm?.name ?? 'your realm') : (user?.displayName ?? 'your profile');
  const handle = toCreator ? realm?.slug : user?.username;
  const imageUrl = toCreator ? realm?.iconUrl : user?.avatarUrl;
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-background/92 backdrop-blur-2xl"
    >
      {/* Ambient bloom, so the splash reads as branded rather than a blank page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 rounded-full blur-[120px]"
        style={{ backgroundColor: 'rgba(196, 20, 63, 0.28)' }}
      />

      <div className="relative flex flex-col items-center gap-5">
        <div className="relative">
          <div className="w-24 h-24 rounded-full overflow-hidden brand-gradient flex items-center justify-center text-3xl font-bold text-white shadow-2xl">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          {/* Ring spinner around the avatar — the only motion on the screen. */}
          <span
            aria-hidden
            className="absolute -inset-2 rounded-full border-2 border-transparent border-t-primary animate-spin"
          />
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">Switching to</p>
          <p className="mt-1 text-xl font-bold text-foreground">{name}</p>
          {handle && <p className="text-sm text-muted-foreground">@{handle}</p>}
          <p className="mt-3 text-xs text-muted-foreground">
            {toCreator ? 'Creator profile' : 'Fan profile'}
          </p>
        </div>
      </div>
    </div>
  );
};
