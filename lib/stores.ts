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
  isAuthenticated: boolean;
  authModalOpen: boolean;
  pendingVerificationEmail: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  setAuthModalOpen: (open: boolean) => void;
  setPendingVerificationEmail: (email: string | null) => void;
  updateUser: (patch: Partial<User>) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      authModalOpen: false,
      pendingVerificationEmail: null,
      login: (user, accessToken) =>
        set({ user, accessToken, isAuthenticated: true, pendingVerificationEmail: null }),
      logout: () => {
        // The next account to sign in must not inherit this one's creator page.
        useProfileMode.getState().reset();
        set({ user: null, accessToken: null, isAuthenticated: false });
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
