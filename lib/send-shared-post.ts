'use client';

import { collection, doc, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { chatDb, directConversationId, ensureChatAuth } from './chatClient';
import { useAuth } from './stores';

/** Called only after the user selects recipients and presses Send. */
export async function sendSharedPost(recipientId: string, text: string) {
  const senderId = useAuth.getState().user?.id;
  if (!senderId || !recipientId || senderId === recipientId) throw new Error('Choose a friend to share with.');
  if (!text.trim() || text.length > 4000) throw new Error('This message is too long.');
  const uid = await ensureChatAuth();
  if (uid !== senderId || useAuth.getState().user?.id !== senderId) throw new Error('Your account changed. Please reopen the share menu.');

  const db = chatDb();
  const conversation = doc(db, 'conversations', directConversationId(senderId, recipientId));
  // Create the parent first: the existing message rules require it to exist.
  // A transaction preserves the preview if another client creates it first.
  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(conversation);
    if (!existing.exists()) transaction.set(conversation, {
      participants: [senderId, recipientId].sort(), createdAt: serverTimestamp(), lastMessage: null,
    });
  });
  if (useAuth.getState().user?.id !== senderId) throw new Error('Please sign in again to share.');
  const batch = writeBatch(db);
  batch.set(doc(collection(conversation, 'messages')), {
    senderId, text, type: 'text', timestamp: serverTimestamp(), readBy: [senderId],
  });
  batch.update(conversation, { lastMessage: { text, senderId, timestamp: serverTimestamp() } });
  await batch.commit();
}
