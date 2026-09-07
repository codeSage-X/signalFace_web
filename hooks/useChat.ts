'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { chatDb, ensureChatAuth, isChatConfigured, logChatError } from '@/lib/chatClient';
import { useAuth } from '@/lib/stores';

export interface ChatMessage {
  id: string;
  senderId: string;
  text: string;
  /** 'text' today; the field exists so images can be added without a migration. */
  type: 'text' | 'image';
  /** Null until the server timestamp lands, moments after an optimistic write. */
  timestamp: Date | null;
  readBy: string[];
}

export interface ConversationPreview {
  id: string;
  participants: string[];
  lastMessage: { text: string; senderId: string; timestamp: Date | null } | null;
  unreadCount: number;
}

type ConversationRow = Omit<ConversationPreview, 'unreadCount'>;

/** Firestore hands back a Timestamp, or null while the server value is pending. */
function toDate(value: unknown): Date | null {
  if (!value) return null;
  const stamp = value as Timestamp;
  return typeof stamp.toDate === 'function' ? stamp.toDate() : null;
}

/**
 * One conversation, live.
 *
 * Firestore is the whole transport: there is no polling and no API endpoint
 * behind this beyond the one that mints the sign-in credential.
 */
export function useChat(conversationId: string | null, otherUserId: string | null) {
  const me = useAuth((s) => s.user?.id) ?? null;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!conversationId || !me) return;

    if (!isChatConfigured) {
      setError('Chat is not configured.');
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        await ensureChatAuth();
        if (cancelled) return;

        const db = chatDb();
        const conversation = doc(db, 'conversations', conversationId);

        // Created on first open rather than up front, so browsing to a profile
        // doesn't litter Firestore with empty rooms. `merge` keeps this safe when
        // both people open the thread at the same moment.
        const existing = await getDoc(conversation);
        if (!existing.exists()) {
          await setDoc(
            conversation,
            {
              participants: otherUserId ? [me, otherUserId].sort() : [me],
              createdAt: serverTimestamp(),
              lastMessage: null,
            },
            { merge: true },
          );
        }

        if (cancelled) return;

        unsubscribe = onSnapshot(
          query(collection(conversation, 'messages'), orderBy('timestamp', 'asc')),
          (snapshot) => {
            setMessages(
              snapshot.docs.map((d) => {
                const data = d.data();
                return {
                  id: d.id,
                  senderId: data.senderId,
                  text: data.text ?? '',
                  type: data.type ?? 'text',
                  timestamp: toDate(data.timestamp),
                  readBy: data.readBy ?? [],
                };
              }),
            );
            setLoading(false);
          },
          (err) => {
            logChatError(`messages listener (${conversationId})`, err);
            setError(err.message || 'Lost connection to chat.');
            setLoading(false);
          },
        );
      } catch (err) {
        if (cancelled) return;
        logChatError(`opening conversation ${conversationId}`, err);
        setError(err instanceof Error ? err.message : 'Could not open this chat.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [conversationId, otherUserId, me]);

  const sendMessage = useCallback(
    async (text: string) => {
      const body = text.trim();
      if (!body || !conversationId || !me) return;

      setSending(true);
      try {
        await ensureChatAuth();
        const db = chatDb();
        const conversation = doc(db, 'conversations', conversationId);

        // readBy starts with the sender: your own message is never unread to you,
        // which is what keeps the badge from counting it.
        await addDoc(collection(conversation, 'messages'), {
          senderId: me,
          text: body,
          type: 'text',
          timestamp: serverTimestamp(),
          readBy: [me],
        });

        // Denormalised so a conversation list can show a preview without reading
        // every thread's messages.
        await updateDoc(conversation, {
          lastMessage: { text: body, senderId: me, timestamp: serverTimestamp() },
        });
      } catch (err) {
        logChatError('sending a message', err);
        // Rethrown so the composer can put the text back in the box.
        throw err;
      } finally {
        setSending(false);
      }
    },
    [conversationId, me],
  );

  const markAsRead = useCallback(
    async (ids: string[]) => {
      if (!ids.length || !conversationId || !me) return;

      await ensureChatAuth();
      const db = chatDb();
      const conversation = doc(db, 'conversations', conversationId);

      // One atomic commit rather than a write per message — a thread opened after
      // a long absence can have dozens to mark.
      const batch = writeBatch(db);
      ids.forEach((id) => {
        batch.update(doc(collection(conversation, 'messages'), id), {
          readBy: arrayUnion(me),
        });
      });

      try {
        await batch.commit();
      } catch (err) {
        // Not surfaced in the UI — failing to mark read is invisible to the
        // reader — but it must not disappear silently either.
        logChatError('marking messages read', err);
        throw err;
      }
    },
    [conversationId, me],
  );

  return { messages, loading, error, sending, sendMessage, markAsRead, me };
}

/**
 * Unread count for one conversation, as its own listener.
 *
 * Deliberately independent of `useChat`: the badge is rendered in the nav, far
 * from any open thread, and must keep counting whether or not a thread is on
 * screen. Sharing one listener would couple the two lifecycles for no gain.
 */
export function useChatUnread(conversationId: string | null) {
  const me = useAuth((s) => s.user?.id) ?? null;
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!conversationId || !me || !isChatConfigured) {
      setCount(0);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        await ensureChatAuth();
        if (cancelled) return;

        const messages = collection(
          doc(chatDb(), 'conversations', conversationId),
          'messages',
        );

        // Filtered client-side on readBy: Firestore can't express "array does not
        // contain", so the sender filter goes in the query and the rest here.
        unsubscribe = onSnapshot(
          query(messages, where('senderId', '!=', me)),
          (snapshot) => {
            setCount(
              snapshot.docs.filter((d) => !(d.data().readBy ?? []).includes(me)).length,
            );
          },
          (err) => {
            // The likeliest cause here is a missing index for the senderId
            // inequality — logChatError spells that out.
            logChatError(`unread listener (${conversationId})`, err);
            setCount(0);
          },
        );
      } catch (err) {
        logChatError(`unread listener setup (${conversationId})`, err);
        if (!cancelled) setCount(0);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [conversationId, me]);

  return count;
}

/**
 * Aggregate unread state for the whole inbox. Conversation documents only store
 * `lastMessage`, so unread counts come from each thread's messages collection.
 */
export function useMessageNotifications({ silent = true }: { silent?: boolean } = {}) {
  const me = useAuth((s) => s.user?.id) ?? null;
  const [counts, setCounts] = useState<Record<string, number>>({});
  const messageUnsubscribers = useRef<Record<string, () => void>>({});

  useEffect(() => {
    const stopMessageListeners = () => {
      Object.values(messageUnsubscribers.current).forEach((unsubscribe) => unsubscribe());
      messageUnsubscribers.current = {};
    };

    if (!me || !isChatConfigured) {
      stopMessageListeners();
      setCounts({});
      return;
    }

    let unsubscribeConversations: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        await ensureChatAuth({ silent });
        if (cancelled) return;

        unsubscribeConversations = onSnapshot(
          query(
            collection(chatDb(), 'conversations'),
            where('participants', 'array-contains', me),
          ),
          (snapshot) => {
            const activeIds = new Set(snapshot.docs.map((d) => d.id));

            Object.entries(messageUnsubscribers.current).forEach(([id, unsubscribe]) => {
              if (!activeIds.has(id)) {
                unsubscribe();
                delete messageUnsubscribers.current[id];
                setCounts((prev) => {
                  const next = { ...prev };
                  delete next[id];
                  return next;
                });
              }
            });

            snapshot.docs.forEach((conversationDoc) => {
              const conversationId = conversationDoc.id;
              if (messageUnsubscribers.current[conversationId]) return;

              const messages = collection(
                doc(chatDb(), 'conversations', conversationId),
                'messages',
              );

              messageUnsubscribers.current[conversationId] = onSnapshot(
                query(messages, where('senderId', '!=', me)),
                (messagesSnapshot) => {
                  const count = messagesSnapshot.docs.filter(
                    (d) => !(d.data().readBy ?? []).includes(me),
                  ).length;
                  setCounts((prev) => ({ ...prev, [conversationId]: count }));
                },
                (err) => {
                  if (!silent) logChatError(`notification listener (${conversationId})`, err);
                  setCounts((prev) => ({ ...prev, [conversationId]: 0 }));
                },
              );
            });
          },
          (err) => {
            if (!silent) logChatError('notification conversations listener', err);
            stopMessageListeners();
            setCounts({});
          },
        );
      } catch (err) {
        if (!silent) logChatError('notification listener setup', err);
        if (!cancelled) {
          stopMessageListeners();
          setCounts({});
        }
      }
    })();

    return () => {
      cancelled = true;
      unsubscribeConversations?.();
      stopMessageListeners();
    };
  }, [me, silent]);

  const total = useMemo(
    () => Object.values(counts).reduce((sum, count) => sum + count, 0),
    [counts],
  );

  return { counts, total };
}

/**
 * Every conversation the signed-in user is part of, newest activity first, for
 * the inbox. Ordering is done client-side so a thread with no messages yet still
 * appears instead of being dropped by an orderBy on a null field.
 */
export function useConversations() {
  const me = useAuth((s) => s.user?.id) ?? null;
  const { counts: unreadCounts } = useMessageNotifications();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;

    if (!isChatConfigured) {
      setError('Chat is not configured.');
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        await ensureChatAuth();
        if (cancelled) return;

        unsubscribe = onSnapshot(
          query(
            collection(chatDb(), 'conversations'),
            where('participants', 'array-contains', me),
          ),
          (snapshot) => {
            const rows = snapshot.docs.map((d) => {
              const data = d.data();
              const last = data.lastMessage;
              return {
                id: d.id,
                participants: (data.participants ?? []) as string[],
                lastMessage: last
                  ? {
                      text: last.text ?? '',
                      senderId: last.senderId ?? '',
                      timestamp: toDate(last.timestamp),
                    }
                  : null,
              };
            });

            rows.sort(
              (a, b) =>
                (b.lastMessage?.timestamp?.getTime() ?? 0) -
                (a.lastMessage?.timestamp?.getTime() ?? 0),
            );

            setConversations(rows);
            setLoading(false);
          },
          (err) => {
            logChatError('conversations listener', err);
            setError(err.message || 'Could not load your messages.');
            setLoading(false);
          },
        );
      } catch (err) {
        if (cancelled) return;
        logChatError('loading conversations', err);
        setError(err instanceof Error ? err.message : 'Could not load your messages.');
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [me]);

  const withUnreadCounts = useMemo(
    () =>
      conversations.map((conversation) => ({
        ...conversation,
        unreadCount: unreadCounts[conversation.id] ?? 0,
      })),
    [conversations, unreadCounts],
  );

  return { conversations: withUnreadCounts, loading, error };
}
