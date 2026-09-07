'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, MessageCircle, Search as SearchIcon } from 'lucide-react';
import { usersApi, type FollowPerson } from '@/lib/api';
import { useAuth } from '@/lib/stores';
import { useConversations } from '@/hooks/useChat';
import { directConversationId, isChatConfigured } from '@/lib/chatClient';
import { ChatThread } from '@/components/chat/ChatThread';

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

function MessagesInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isAuthenticated, setAuthModalOpen } = useAuth();

  // Who the open thread is with. Carried in the URL so a "Message" button on a
  // profile can deep-link straight into the conversation.
  const withUsername = params.get('with');

  const { conversations, loading, error } = useConversations();
  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const [other, setOther] = useState<FollowPerson | null>(null);
  const [otherLoading, setOtherLoading] = useState(false);

  // The conversation list stores ids; the header needs names and avatars, so the
  // people in it are resolved separately.
  const [people, setPeople] = useState<Record<string, FollowPerson>>({});
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!withUsername) {
      setOther(null);
      return;
    }

    let cancelled = false;
    setOtherLoading(true);

    usersApi
      .getPublicProfile(withUsername)
      .then((profile) => {
        if (cancelled) return;
        setOther({
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          creatorStatus: profile.creatorStatus,
          followersCount: profile.followersCount,
          isFollowedByMe: profile.isFollowedByMe,
        });
      })
      .catch(() => {
        if (!cancelled) setOther(null);
      })
      .finally(() => {
        if (!cancelled) setOtherLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [withUsername]);

  // Resolve the other participant of every thread, so the list can show who it
  // is rather than a raw id.
  useEffect(() => {
    if (!user?.id || conversations.length === 0) return;

    const missing = conversations
      .map((c) => c.participants.find((p) => p !== user.id))
      .filter((id): id is string => Boolean(id) && !people[id!]);

    if (missing.length === 0) return;

    let cancelled = false;

    // One request for every unknown participant, rather than one per thread.
    usersApi
      .byIds(missing)
      .then((res) => {
        if (cancelled) return;
        const next: Record<string, FollowPerson> = {};
        res.items.forEach((person) => {
          next[person.id] = person;
        });
        if (Object.keys(next).length) setPeople((prev) => ({ ...prev, ...next }));
      })
      .catch((err) => {
        // Without this the inbox just shows "Loading…" forever with no clue why.
        // eslint-disable-next-line no-console
        console.error('[chat] could not resolve conversation participants', err);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, user?.id]);

  const conversationId = useMemo(
    () => (user?.id && other?.id ? directConversationId(user.id, other.id) : null),
    [user?.id, other?.id],
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations.filter((c) => {
      const otherId = c.participants.find((p) => p !== user?.id);
      const person = otherId ? people[otherId] : undefined;
      if (!term) return true;
      return (
        person?.displayName.toLowerCase().includes(term) ||
        person?.username.toLowerCase().includes(term)
      );
    });
  }, [conversations, people, search, user?.id]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
          <MessageCircle size={24} className="text-muted-foreground" />
        </div>
        <p className="text-foreground font-semibold text-lg">Sign in to see your messages</p>
        <p className="text-muted-foreground text-sm mt-1 mb-5">
          Your conversations live here.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="px-6 py-2.5 rounded-xl font-semibold text-white text-sm brand-gradient hover:brightness-110 transition"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (!isChatConfigured) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <p className="text-foreground font-semibold">Chat isn’t configured yet</p>
        <p className="text-muted-foreground text-sm mt-1 max-w-sm">
          The Firebase keys are missing from this environment, so messaging is
          switched off. Everything else works as normal.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] lg:h-[calc(100vh-3.5rem)] flex overflow-hidden">
      {/* Inbox. Hidden on mobile while a thread is open, so one pane fills the screen. */}
      <aside
        className={`w-full lg:w-80 flex-shrink-0 border-r border-white/10 flex flex-col min-h-0 ${
          other ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-3 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h1 className="text-lg font-bold text-foreground">Messages</h1>
            {unreadTotal > 0 && (
              <span className="px-2 py-1 rounded-full bg-primary/15 text-primary text-xs font-bold">
                {unreadTotal > 99 ? '99+' : unreadTotal} unread
              </span>
            )}
          </div>
          <div className="relative">
            <SearchIcon
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="w-full pl-9 pr-3 py-2 rounded-full glass-input text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-white/[0.06] animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-28 rounded bg-white/[0.06] animate-pulse" />
                    <div className="h-3 w-40 rounded bg-white/[0.06] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="p-4 text-sm text-muted-foreground">{error}</p>
          ) : visible.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-sm font-semibold text-foreground">No conversations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Open someone’s profile and tap Message to start one.
              </p>
            </div>
          ) : (
            <ul>
              {visible.map((conversation) => {
                const otherId = conversation.participants.find((p) => p !== user?.id);
                const person = otherId ? people[otherId] : undefined;
                const active = otherId === other?.id;
                const unread = conversation.unreadCount > 0;
                const unreadLabel =
                  conversation.unreadCount > 99 ? '99+' : String(conversation.unreadCount);

                return (
                  <li key={conversation.id}>
                    <button
                      onClick={() =>
                        person &&
                        router.push(`/app/messages?with=${encodeURIComponent(person.username)}`)
                      }
                      className={`w-full flex items-center gap-3 p-3 text-left transition hover:bg-white/[0.04] ${
                        active ? 'bg-white/[0.06]' : ''
                      }`}
                    >
                      <span className="relative w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {person?.avatarUrl ? (
                          <img
                            src={person.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initialsOf(person?.displayName ?? '?')
                        )}
                        {unread && (
                          <span className="absolute right-0 bottom-0 w-3 h-3 rounded-full bg-primary ring-2 ring-background" />
                        )}
                      </span>

                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-sm truncate ${
                            unread ? 'font-bold text-foreground' : 'font-semibold text-foreground'
                          }`}
                        >
                          {person?.displayName ?? 'Loading…'}
                        </span>
                        <span
                          className={`block text-xs truncate ${
                            unread ? 'font-semibold text-foreground' : 'text-muted-foreground'
                          }`}
                        >
                          {conversation.lastMessage
                            ? `${
                                conversation.lastMessage.senderId === user?.id ? 'You: ' : ''
                              }${conversation.lastMessage.text}`
                            : 'No messages yet'}
                        </span>
                      </span>

                      {unread && (
                        <span
                          aria-label={`${conversation.unreadCount} unread message${
                            conversation.unreadCount === 1 ? '' : 's'
                          }`}
                          className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold leading-5 text-center flex-shrink-0 shadow-sm shadow-primary/40"
                        >
                          {unreadLabel}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section className={`flex-1 min-w-0 ${other ? 'flex' : 'hidden lg:flex'} flex-col min-h-0`}>
        {otherLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : other && conversationId ? (
          <ChatThread
            conversationId={conversationId}
            other={other}
            onBack={() => router.push('/app/messages')}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
              <MessageCircle size={24} className="text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold">Your messages</p>
            <p className="text-muted-foreground text-sm mt-1">
              Pick a conversation, or start one from someone’s profile.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MessagesInner />
    </Suspense>
  );
}
