'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
  invitedMemberIds: string[];
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

export interface GroupPost {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  text: string;
  media?: ChatMediaUpload;
  createdAt: Date | null;
}

export interface GroupComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  text: string;
  createdAt: Date | null;
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
  {
    id: 'career-jobs',
    name: 'Career & Jobs',
    description: 'Discover opportunities, improve your CV, prepare for interviews, and grow your career.',
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Discuss entrepreneurship, sales, funding, operations, and building sustainable businesses.',
  },
  {
    id: 'technology-ai',
    name: 'Technology & AI',
    description: 'Explore software, digital skills, emerging technology, artificial intelligence, and useful tools.',
  },
  {
    id: 'personal-finance',
    name: 'Personal Finance',
    description: 'Share practical ideas about budgeting, saving, responsible investing, and financial planning.',
  },
  {
    id: 'parenting',
    name: 'Parenting',
    description: 'Connect around childcare, education, family life, and the everyday realities of raising children.',
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    description: 'Talk about films, music, television, creators, celebrity news, and popular culture.',
  },
  {
    id: 'sports',
    name: 'Sports',
    description: 'Follow football, basketball, major competitions, match discussions, and sporting stories.',
  },
  {
    id: 'food-cooking',
    name: 'Food & Cooking',
    description: 'Exchange recipes, cooking techniques, restaurant recommendations, and food discoveries.',
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
    invitedMemberIds: Array.isArray(data.invitedMemberIds) ? data.invitedMemberIds as string[] : [],
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
      invitedMemberIds: [],
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

  const inviteMember = useCallback(async (group: InterestGroup, memberId: string) => {
    if (!user || !group.memberIds.includes(user.id)) throw new Error('Join the group before inviting people.');
    if (group.memberIds.includes(memberId) || group.invitedMemberIds.includes(memberId)) return;
    await ensureChatAuth();
    await updateDoc(doc(chatDb(), 'groups', group.id), {
      invitedMemberIds: arrayUnion(memberId),
    });
  }, [user]);

  const acceptInvite = useCallback(async (group: InterestGroup) => {
    if (!user || !group.invitedMemberIds.includes(user.id)) throw new Error('This invitation is no longer available.');
    await ensureChatAuth();
    await updateDoc(doc(chatDb(), 'groups', group.id), {
      memberIds: arrayUnion(user.id),
      invitedMemberIds: arrayRemove(user.id),
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
        invitedMemberIds: [],
        createdAt: serverTimestamp(),
      });
    }
  }, [user]);

  return { createGroup, joinGroup, approveRequest, inviteMember, acceptInvite, createSystemGroup, user };
}

export function useGroupPosts(groupId: string, isMember: boolean) {
  const user = useAuth((state) => state.user);
  const [posts, setPosts] = useState<GroupPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMember || !isChatConfigured) {
      setPosts([]);
      setLoading(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureChatAuth().then(() => {
      if (cancelled) return;
      unsubscribe = onSnapshot(
        query(collection(chatDb(), 'groups', groupId, 'posts'), orderBy('createdAt', 'desc')),
        (snapshot) => {
          setPosts(snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              authorId: String(data.authorId ?? ''),
              authorName: String(data.authorName ?? 'Member'),
              authorAvatarUrl: typeof data.authorAvatarUrl === 'string' ? data.authorAvatarUrl : null,
              text: String(data.text ?? ''),
              media: data.media ?? undefined,
              createdAt: toDate(data.createdAt),
            };
          }));
          setLoading(false);
        },
        (error) => {
          logChatError('group posts listener', error);
          setLoading(false);
        },
      );
    }).catch(() => setLoading(false));
    return () => { cancelled = true; unsubscribe?.(); };
  }, [groupId, isMember]);

  const createPost = useCallback(async (text: string, media?: ChatMediaUpload) => {
    if (!user || (!text.trim() && !media)) return;
    await ensureChatAuth();
    await addDoc(collection(chatDb(), 'groups', groupId, 'posts'), {
      authorId: user.id,
      authorName: user.displayName,
      authorAvatarUrl: user.avatarUrl ?? null,
      text: text.trim(),
      ...(media ? { media } : {}),
      createdAt: serverTimestamp(),
    });
  }, [groupId, user]);

  return { posts, loading, createPost };
}

export function useGroupPostLikes(groupId: string, postId: string, isMember: boolean) {
  const user = useAuth((state) => state.user);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!isMember || !user || !isChatConfigured) {
      setLikeCount(0);
      setLiked(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureChatAuth().then(() => {
      if (cancelled) return;
      unsubscribe = onSnapshot(
        collection(chatDb(), 'groups', groupId, 'posts', postId, 'likes'),
        (snapshot) => {
          setLikeCount(snapshot.size);
          setLiked(snapshot.docs.some((entry) => entry.id === user.id));
        },
        (error) => logChatError('group post likes listener', error),
      );
    }).catch((error) => logChatError('group post likes listener', error));
    return () => { cancelled = true; unsubscribe?.(); };
  }, [groupId, postId, isMember, user]);

  const toggleLike = useCallback(async () => {
    if (!user || !isMember) throw new Error('Join the group to like posts.');
    await ensureChatAuth();
    const likeRef = doc(chatDb(), 'groups', groupId, 'posts', postId, 'likes', user.id);
    const existing = await getDoc(likeRef);
    if (existing.exists()) {
      await deleteDoc(likeRef);
    } else {
      await setDoc(likeRef, { userId: user.id, createdAt: serverTimestamp() });
    }
  }, [groupId, postId, isMember, user]);

  return { likeCount, liked, toggleLike };
}

export function useGroupComments(groupId: string, postId: string, isMember: boolean) {
  const user = useAuth((state) => state.user);
  const [comments, setComments] = useState<GroupComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMember || !isChatConfigured) {
      setComments([]);
      setLoading(false);
      return;
    }
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    ensureChatAuth().then(() => {
      if (cancelled) return;
      unsubscribe = onSnapshot(
        query(collection(chatDb(), 'groups', groupId, 'posts', postId, 'comments'), orderBy('createdAt', 'asc')),
        (snapshot) => {
          setComments(snapshot.docs.map((entry) => {
            const data = entry.data();
            return {
              id: entry.id,
              authorId: String(data.authorId ?? ''),
              authorName: String(data.authorName ?? 'Member'),
              authorAvatarUrl: typeof data.authorAvatarUrl === 'string' ? data.authorAvatarUrl : null,
              text: String(data.text ?? ''),
              createdAt: toDate(data.createdAt),
            };
          }));
          setLoading(false);
        },
        (error) => {
          logChatError('group comments listener', error);
          setLoading(false);
        },
      );
    }).catch(() => setLoading(false));
    return () => { cancelled = true; unsubscribe?.(); };
  }, [groupId, postId, isMember]);

  const addComment = useCallback(async (text: string) => {
    if (!user || !text.trim()) return;
    await ensureChatAuth();
    await addDoc(collection(chatDb(), 'groups', groupId, 'posts', postId, 'comments'), {
      authorId: user.id,
      authorName: user.displayName,
      authorAvatarUrl: user.avatarUrl ?? null,
      text: text.trim(),
      createdAt: serverTimestamp(),
    });
  }, [groupId, postId, user]);

  return { comments, loading, addComment };
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
