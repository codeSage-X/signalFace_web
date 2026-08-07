'use client';

import { useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { realmsApi } from '@/lib/api';
import { useAuth, useProfileMode, type ProfileMode } from '@/lib/stores';

/** How long the "Switching…" splash holds before the new profile is revealed. */
export const SWITCH_DURATION_MS = 1100;

/** Where each profile mode lands. */
const HOME: Record<ProfileMode, string> = {
  fan: '/app/profile',
  creator: '/app/realm',
};

/**
 * Keeps the cached realm in sync with the server for as long as the user is
 * signed in. Mount once, high in the tree — everything else reads the store.
 */
export const useMyRealmSync = () => {
  const { isAuthenticated } = useAuth();
  const setRealm = useProfileMode((s) => s.setRealm);

  useEffect(() => {
    if (!isAuthenticated) {
      setRealm(null);
      return;
    }

    let cancelled = false;
    realmsApi
      .getMine()
      .then((realm) => {
        if (!cancelled) setRealm(realm);
      })
      // A failure here shouldn't strand the user in creator mode with stale
      // data, but it also shouldn't wipe a realm we already know about.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setRealm]);
};

/**
 * Facebook-style profile switching: raise the splash, navigate underneath it,
 * then commit the mode change once the new surface has had time to paint.
 */
export const useProfileSwitch = () => {
  const router = useRouter();
  const { mode, realm, switchingTo, beginSwitch, completeSwitch } = useProfileMode();

  const switchTo = useCallback(
    (to: ProfileMode, destination?: string) => {
      // Guard both ways: no creator page means no creator mode, and
      // re-switching to the mode you're already in should be a no-op.
      if (to === 'creator' && !realm) return;
      if (to === mode && !destination) return;

      beginSwitch(to);
      router.push(destination ?? HOME[to]);
      window.setTimeout(completeSwitch, SWITCH_DURATION_MS);
    },
    [mode, realm, beginSwitch, completeSwitch, router],
  );

  return {
    mode,
    realm,
    isCreator: Boolean(realm),
    switching: switchingTo !== null,
    switchingTo,
    switchTo,
  };
};
