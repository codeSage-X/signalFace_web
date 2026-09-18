'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  arrayRemove,
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
  type Timestamp,
} from 'firebase/firestore';
import { chatDb, ensureChatAuth, isChatConfigured, logChatError } from '@/lib/chatClient';
import { useAuth } from '@/lib/stores';
import type { ChatMediaUpload } from '@/lib/api';

export type GroupPrivacy = 'open' | 'private';

export interface InterestGroup {
  id: string;
  name: string;
  description: string;
  privacy: GroupPrivacy;
  systemCreated: boolean;
  ownerId: string | null;
  memberIds: string[];
  pendingMemberIds: string[];
  createdAt: Date | null;
}

export interface GroupMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  type: 'text' | 'image' | 'video' | 'gif';
  media?: ChatMediaUpload;
  timestamp: Date | null;
}

export const SYSTEM_GROUPS = [
  {
    id: 'single-forum',
    name: 'Single Forum',
    description: 'Meet people, swap dating stories, and talk through modern romance.',
  },
  {
    id: 'marriage-advice',
    name: 'Marriage Advice',
    description: 'Thoughtful conversations about partnership, trust, and communication.',
  },
  {
    id: 'health-solutions',
    name: 'Health Solutions',
    description: 'Share routines, encouragement, and practical wellbeing ideas.',
  },
] as const;

function toDate(value: unknown): Date | null {
  const stamp = value as Timestamp | null;
  return stamp && typeof stamp.toDate === 'function' ? stamp.toDate() : null;
}

function toGroup(id: string, data: Record<string, unknown>): InterestGroup {
  return {
    id,
    name: String(data.name ?? ''),
    description: String(data.description ?? ''),
    privacy: data.privacy === 'private' ? 'private' : 'open',
    systemCreated: Boolean(data.systemCreated),
    ownerId: typeof data.ownerId === 'string' ? data.ownerId : null,
    memberIds: Array.isArray(data.memberIds) ? data.memberIds as string[] : [],
    pendingMemberIds: Array.isArray(data.pendingMemberIds) ? data.pendingMemberIds as string[] : [],
    createdAt: toDate(data.createdAt),
  };
}

export function useGroups() {
  const [groups, setGroups] = useState<InterestGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isChatConfigured) {
      setLoading(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureChatAuth()
      .then(() => {
        if (cancelled) return;
        unsubscribe = onSnapshot(collection(chatDb(), 'groups'), (snapshot) => {
          setGroups(snapshot.docs.map((entry) => toGroup(entry.id, entry.data())));
          setLoading(false);
        }, (error) => {
          logChatError('groups listener', error);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return { groups, loading };
}

export function useGroup(groupId: string) {
  const [group, setGroup] = useState<InterestGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isChatConfigured) {
      setLoading(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureChatAuth()
      .then(() => {
        if (cancelled) return;
        unsubscribe = onSnapshot(doc(chatDb(), 'groups', groupId), (snapshot) => {
          setGroup(snapshot.exists() ? toGroup(snapshot.id, snapshot.data()) : null);
          setLoading(false);
        }, (error) => {
          logChatError('group listener', error);
          setLoading(false);
        });
      })
      .catch(() => setLoading(false));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [groupId]);

  return { group, loading };
}

export function useGroupActions() {
  const user = useAuth((state) => state.user);

  const createGroup = useCallback(async (name: string, description: string, privacy: GroupPrivacy) => {
    if (!user) throw new Error('Sign in to create a group.');
    await ensureChatAuth();
    const group = await addDoc(collection(chatDb(), 'groups'), {
      name: name.trim(),
      description: description.trim(),
      privacy,
      systemCreated: false,
      ownerId: user.id,
      memberIds: [user.id],
      pendingMemberIds: [],
      createdAt: serverTimestamp(),
    });
    return group.id;
  }, [user]);

  const joinGroup = useCallback(async (group: InterestGroup) => {
    if (!user) throw new Error('Sign in to join a group.');
    await ensureChatAuth();
    const ref = doc(chatDb(), 'groups', group.id);
    if (group.memberIds.includes(user.id) || group.pendingMemberIds.includes(user.id)) return;
    await updateDoc(ref, group.privacy === 'open'
      ? { memberIds: arrayUnion(user.id) }
      : { pendingMemberIds: arrayUnion(user.id) });
  }, [user]);

  const approveRequest = useCallback(async (group: InterestGroup, memberId: string) => {
    if (!user || group.ownerId !== user.id) throw new Error('Only the group owner can approve members.');
    await ensureChatAuth();
    await updateDoc(doc(chatDb(), 'groups', group.id), {
      memberIds: arrayUnion(memberId),
      pendingMemberIds: arrayRemove(memberId),
    });
  }, [user]);

  const createSystemGroup = useCallback(async (systemId: string) => {
    const source = SYSTEM_GROUPS.find((entry) => entry.id === systemId);
    if (!user || !source) throw new Error('Sign in to join a group.');
    await ensureChatAuth();
    const ref = doc(chatDb(), 'groups', source.id);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        ...source,
        privacy: 'open',
        systemCreated: true,
        ownerId: null,
        memberIds: [user.id],
        pendingMemberIds: [],
        createdAt: serverTimestamp(),
      });
    }
  }, [user]);

  return { createGroup, joinGroup, approveRequest, createSystemGroup, user };
}

export function useGroupMessages(groupId: string, isMember: boolean) {
  const user = useAuth((state) => state.user);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMember || !isChatConfigured) {
      setMessages([]);
      setLoading(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureChatAuth().then(() => {
      if (cancelled) return;
      unsubscribe = onSnapshot(query(collection(chatDb(), 'groups', groupId, 'messages'), orderBy('timestamp', 'asc')), (snapshot) => {
        setMessages(snapshot.docs.map((entry) => {
          const data = entry.data();
          return { id: entry.id, senderId: data.senderId, senderName: data.senderName ?? 'Member', text: data.text ?? '', type: data.type ?? 'text', media: data.media ?? undefined, timestamp: toDate(data.timestamp) };
        }));
        setLoading(false);
      }, (error) => {
        logChatError('group messages listener', error);
        setLoading(false);
      });
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [groupId, isMember]);

  const sendMessage = useCallback(async (text: string, media?: ChatMediaUpload) => {
    if (!user || (!text.trim() && !media)) return;
    await ensureChatAuth();
    await addDoc(collection(chatDb(), 'groups', groupId, 'messages'), {
      senderId: user.id,
      senderName: user.displayName,
      text: text.trim(),
      type: media?.type ?? 'text',
      ...(media ? { media } : {}),
      timestamp: serverTimestamp(),
    });
  }, [groupId, user]);

  return { messages, loading, sendMessage };
}
