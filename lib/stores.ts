'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
// Type-only, so this does not create a runtime cycle with api.ts (which imports
// `useAuth` from here).
import type { Realm } from './api';

/**
 * Which identity the user is acting as. A creator has two: their personal
 * "fan" profile and their realm (creator page), and — as on Facebook — they
 * are only ever in one at a time. Realm management is gated on `creator`.
 */
export type ProfileMode = 'fan' | 'creator';

export interface ProfileModeState {
  mode: ProfileMode;
  /** The viewer's own realm, cached so the switcher paints without a fetch. */
  realm: Realm | null;
  /** Target of an in-flight switch; drives the "Switching…" splash. */
  switchingTo: ProfileMode | null;
  /** The creator sign-up modal, opened from any profile menu. */
  becomeCreatorOpen: boolean;
  setRealm: (realm: Realm | null) => void;
  setBecomeCreatorOpen: (open: boolean) => void;
  beginSwitch: (to: ProfileMode) => void;
  completeSwitch: () => void;
  reset: () => void;
}

export const useProfileMode = create<ProfileModeState>()(
  persist(
    (set) => ({
      mode: 'fan',
      realm: null,
      switchingTo: null,
      becomeCreatorOpen: false,
      setBecomeCreatorOpen: (open) => set({ becomeCreatorOpen: open }),
      setRealm: (realm) =>
        // Losing the realm (or having it suspended) must drop you back to the
        // fan profile, or the UI offers creator actions that would 403.
        set((s) => ({
          realm,
          mode: realm && realm.status === 'APPROVED' ? s.mode : 'fan',
        })),
      beginSwitch: (to) => set({ switchingTo: to }),
      completeSwitch: () =>
        set((s) => ({ mode: s.switchingTo ?? s.mode, switchingTo: null })),
      reset: () =>
        set({ mode: 'fan', realm: null, switchingTo: null, becomeCreatorOpen: false }),
    }),
    {
      name: 'profile-mode-storage',
      // `switchingTo` is deliberately not persisted — a reload mid-switch would
      // otherwise restore a splash screen that nothing ever dismisses.
      partialize: (s) => ({ mode: s.mode, realm: s.realm }),
    },
  ),
);

export interface UserSignal {
  id: string;
  score: string;
  price: string;
  prevScore: string;
  growthPct: string;
  lastScoredAt: string | null;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  username: string;
  displayName: string;
  bio?: string | null;
  websiteUrl?: string | null;
  role: string;
  creatorStatus: string;
  /** Topics driving this person's feed ranking. */
  interests?: string[];
  accountStatus?: 'ACTIVE' | 'RESTRICTED' | 'BLOCKED';
  statusReason?: string | null;
  pointsBalance: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt?: string;
  followingCount?: number;
  followersCount?: number;
  likesCount?: number;
  signal?: UserSignal | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  /** Renews `accessToken` without re-prompting for credentials. */
  refreshToken: string | null;
  isAuthenticated: boolean;
  authModalOpen: boolean;
  pendingVerificationEmail: string | null;
  login: (user: User, token: string, refreshToken: string) => void;
  /** Post-renewal token swap — keeps the session, replaces the credentials. */
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
  setAuthModalOpen: (open: boolean) => void;
  setPendingVerificationEmail: (email: string | null) => void;
  updateUser: (patch: Partial<User>) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      authModalOpen: false,
      pendingVerificationEmail: null,
      login: (user, accessToken, refreshToken) =>
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          pendingVerificationEmail: null,
        }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      logout: () => {
        // Burn the refresh token server-side so signing out actually ends the
        // session rather than leaving a 30-day credential valid in the DB.
        // Fire-and-forget, and deliberately a bare fetch — importing api.ts
        // here would create the runtime cycle the note at the top avoids.
        const token = get().refreshToken;
        if (token) {
          const base =
            process.env.NEXT_PUBLIC_API_URL ?? 'https://signalface-api.onrender.com/api';
          void fetch(`${base}/auth/logout`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: token }),
          }).catch(() => {
            // Signing out locally must succeed even if the API is unreachable.
          });
        }

        // The next account to sign in must not inherit this one's creator page.
        useProfileMode.getState().reset();
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
      setAuthModalOpen: (open) => set({ authModalOpen: open }),
      setPendingVerificationEmail: (email) => set({ pendingVerificationEmail: email }),
      updateUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),
    }),
    { name: 'auth-storage' },
  ),
);

export interface PortfolioSignal {
  id: string;
  creatorName: string;
  signalName: string;
  quantity: number;
  currentPrice: number;
  totalValue: number;
  change24h: number;
}

export const usePortfolio = create<{
  signals: PortfolioSignal[];
  totalValue: number;
  change24h: number;
  addSignal: (s: PortfolioSignal) => void;
  removeSignal: (id: string) => void;
}>()(
  persist(
    (set) => ({
      signals: [],
      totalValue: 8765.23,
      change24h: -15.68,
      addSignal: (signal) =>
        set((s) => ({ signals: [...s.signals, signal] })),
      removeSignal: (id) =>
        set((s) => ({ signals: s.signals.filter((x) => x.id !== id) })),
    }),
    { name: 'portfolio-storage' },
  ),
);

/**
 * Whether video plays with sound. Shared by every player so unmuting one video
 * keeps the rest unmuted as you scroll, the way other social feeds behave —
 * rather than each card starting muted on its own local state.
 *
 * Deliberately not persisted: browsers refuse to autoplay audio until the user
 * has interacted with the page, so a preference restored on a cold load would
 * leave videos silently failing to start. Unmuting *is* that interaction, which
 * is why holding it for the session is both sufficient and safe.
 */
export const useVideoSound = create<{
  muted: boolean;
  toggleMuted: () => void;
  setMuted: (muted: boolean) => void;
}>((set) => ({
  muted: true,
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
  setMuted: (muted) => set({ muted }),
}));

export type PostUploadStatus = 'uploading' | 'processing' | 'error' | 'done';

/**
 * A publish that outlives the page that started it.
 *
 * Posting used to hold the composer open until the server replied. Keeping the
 * progress here instead lets the upload page hand off and navigate away
 * immediately, while a bar pinned to the top of the app reports what is
 * happening — so a slow video upload never blocks browsing.
 *
 * Not persisted: an in-flight XHR cannot survive a reload, so restoring a
 * half-finished bar would describe an upload that no longer exists.
 */
export const usePostUpload = create<{
  status: PostUploadStatus | null;
  percent: number;
  error: string | null;
  /** Re-runs the exact publish that failed. Set only in the error state. */
  retry: (() => void) | null;
  start: (retry: () => void) => void;
  setPercent: (percent: number) => void;
  succeed: () => void;
  fail: (error: string) => void;
  clear: () => void;
}>((set) => ({
  status: null,
  percent: 0,
  error: null,
  retry: null,
  start: (retry) => set({ status: 'uploading', percent: 0, error: null, retry }),
  // Once every byte is sent the server is still transcoding, so the bar stops
  // claiming progress it cannot measure and says so instead.
  setPercent: (percent) =>
    set({ percent, status: percent >= 100 ? 'processing' : 'uploading' }),
  succeed: () => set({ status: 'done', percent: 100, error: null, retry: null }),
  fail: (error) => set({ status: 'error', error }),
  clear: () => set({ status: null, percent: 0, error: null, retry: null }),
}));

const MAX_RECENT_SEARCHES = 8;

/**
 * Recent search terms, newest first. Persisted because the value of the list is
 * that it survives leaving the app — an in-memory version would always be empty
 * on the visit where you actually wanted it.
 */
export const useRecentSearches = create<{
  terms: string[];
  add: (term: string) => void;
  remove: (term: string) => void;
  clear: () => void;
}>()(
  persist(
    (set) => ({
      terms: [],
      add: (term) =>
        set((s) => {
          const value = term.trim();
          if (!value) return s;
          // Re-searching an old term moves it to the top instead of duplicating.
          const deduped = s.terms.filter((t) => t.toLowerCase() !== value.toLowerCase());
          return { terms: [value, ...deduped].slice(0, MAX_RECENT_SEARCHES) };
        }),
      remove: (term) => set((s) => ({ terms: s.terms.filter((t) => t !== term) })),
      clear: () => set({ terms: [] }),
    }),
    { name: 'recent-searches-storage' },
  ),
);

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

export const useToast = create<{
  toasts: Toast[];
  addToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2, 9);
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    if (toast.duration) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, toast.duration);
    }
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
