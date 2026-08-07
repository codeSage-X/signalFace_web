'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  type Auth,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

// Initialised on first use rather than at import time, so a checkout without
// Firebase env vars still renders the rest of the auth modal.
function getFirebaseAuth(): Auth {
  if (!isFirebaseConfigured) {
    throw new Error('Google sign-in is not configured');
  }
  const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

/**
 * Opens the Google popup and returns a Firebase ID token for the signed-in account.
 * The token is the only thing our API trusts — it verifies it with the Admin SDK.
 */
export async function signInWithGoogle(): Promise<string> {
  const auth = getFirebaseAuth();
  const provider = new GoogleAuthProvider();
  // Always let the user pick which Google account, instead of silently reusing the last one.
  provider.setCustomParameters({ prompt: 'select_account' });

  const credential = await signInWithPopup(auth, provider);
  const idToken = await credential.user.getIdToken();

  // Our own JWT is the session from here on; there's no reason to keep the Firebase one alive.
  await signOut(auth).catch(() => {});

  return idToken;
}

/** Popup outcomes the user caused on purpose — not worth surfacing as an error toast. */
export function isUserCancelledAuth(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/user-cancelled'
  );
}
