'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  signInWithCustomToken,
  onAuthStateChanged,
  type Auth,
} from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { authApi } from '@/lib/api';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isChatConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/**
 * One place every chat failure is reported from.
 *
 * Firebase errors carry a `code` — `permission-denied`, `unauthenticated`,
 * `failed-precondition` (a missing index) — and that code is almost always the
 * whole diagnosis, while the message alone is vague. Several of these paths used
 * to swallow their error entirely, which meant a misconfigured project looked
 * like an empty inbox.
 */
export function logChatError(where: string, err: unknown) {
  const code = (err as { code?: string })?.code;
  const message = err instanceof Error ? err.message : String(err);

  // eslint-disable-next-line no-console
  console.error(`[chat] ${where} failed${code ? ` (${code})` : ''}: ${message}`, err);

  // The two failures with a specific fix get told outright, since the console
  // message alone rarely points at the cause.
  if (code === 'permission-denied') {
    // eslint-disable-next-line no-console
    console.error(
      '[chat] Firestore rejected this. Check the rules from firestore.rules are ' +
        'published, and that the signed-in uid is in the conversation participants.',
    );
  }
  if (code === 'failed-precondition') {
    // eslint-disable-next-line no-console
    console.error(
      '[chat] Firestore wants an index for this query. The error above usually ' +
        'contains a link that creates it.',
    );
  }
}

/** If sign-in never settles, the UI shows an error rather than hanging forever. */
const AUTH_TIMEOUT_MS = 8000;

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function chatAuth(): Auth {
  return getAuth(app());
}

export function chatDb(): Firestore {
  return getFirestore(app());
}

/**
 * A deterministic room id for a pair of people.
 *
 * Sorted before joining so both sides derive the same id from opposite
 * arguments — otherwise A→B and B→A would open two different rooms and each
 * person would be talking into their own.
 */
export function directConversationId(a: string, b: string): string {
  return [a, b].sort().join('_');
}

// One in-flight sign-in shared by every caller. Each hook that needs Firestore
// awaits this rather than starting its own, so opening a thread and rendering an
// unread badge don't race to authenticate.
let signInPromise: Promise<string> | null = null;

/**
 * Signs the current user in to Firestore and resolves with their uid.
 *
 * The credential is a custom token minted by our API, so the Firestore uid *is*
 * this app's user id. That is what allows the security rules to be scoped to a
 * conversation's participants instead of trusting every signed-in client.
 */
export function ensureChatAuth(options: { silent?: boolean } = {}): Promise<string> {
  if (!isChatConfigured) {
    // eslint-disable-next-line no-console
    console.error(
      '[chat] Firebase is not configured — NEXT_PUBLIC_FIREBASE_API_KEY and/or ' +
        'NEXT_PUBLIC_FIREBASE_PROJECT_ID are missing from this environment.',
    );
    return Promise.reject(new Error('Chat is not configured'));
  }

  signInPromise ??= (async () => {
    const auth = chatAuth();

    // Already signed in from an earlier visit — the SDK restores this itself.
    if (auth.currentUser) return auth.currentUser.uid;

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Chat sign-in timed out')), AUTH_TIMEOUT_MS),
    );

    const signIn = (async () => {
      const { token } = await authApi.firebaseToken();
      const credential = await signInWithCustomToken(auth, token);
      return credential.user.uid;
    })();

    try {
      return await Promise.race([signIn, timeout]);
    } catch (err) {
      if (!options.silent) logChatError('firestore sign-in', err);
      // Cleared so a later attempt can retry rather than replaying the failure
      // for the rest of the session.
      signInPromise = null;
      throw err;
    }
  })();

  return signInPromise;
}

/** Drops the Firestore session. Called when the user signs out of the app. */
export async function resetChatAuth() {
  signInPromise = null;
  if (!isChatConfigured) return;
  try {
    await chatAuth().signOut();
  } catch (err) {
    // Nothing to do — the local session is gone either way — but say so.
    logChatError('firestore sign-out', err);
  }
}

/** Resolves once the SDK has restored (or failed to restore) a session. */
export function chatAuthSettled(): Promise<void> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(chatAuth(), () => {
      unsubscribe();
      resolve();
    });
  });
}
