'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowLeft, Check, CheckCheck } from 'lucide-react';
import { useChat, type ChatMessage } from '@/hooks/useChat';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { MessageComposer } from '@/components/chat/MessageComposer';
import { MessageMedia } from '@/components/chat/MessageMedia';
import type { FollowPerson } from '@/lib/api';

/** Within this many pixels of the bottom counts as "following the conversation". */
const NEAR_BOTTOM_PX = 80;
/** Marking read is debounced so a burst of snapshots is one write, not many. */
const MARK_READ_DEBOUNCE_MS = 500;

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

function timeLabel(date: Date | null) {
  if (!date) return 'Sending…';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(date: Date) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (sameDay(date, today)) return 'Today';
  if (sameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
}

export function ChatThread({
  conversationId,
  other,
  onBack,
}: {
  conversationId: string;
  /** The person on the other side, for the header and read receipts. */
  other: FollowPerson;
  onBack?: () => void;
}) {
  const { messages, loading, error, sending, sendMessage, markAsRead, me } = useChat(
    conversationId,
    other.id,
  );

  const [nearBottom, setNearBottom] = useState(true);
  const [unseenBelow, setUnseenBelow] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
    setUnseenBelow(false);
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distance <= NEAR_BOTTOM_PX;
    setNearBottom(atBottom);
    if (atBottom) setUnseenBelow(false);
  };

  // Follow the conversation only while the reader is already at the bottom.
  // Yanking their scroll position mid-read is the thing this avoids; if a message
  // arrives from the other person while they're scrolled up, a pill offers the
  // jump instead of forcing it.
  useEffect(() => {
    if (messages.length === lastCountRef.current) return;

    const grew = messages.length > lastCountRef.current;
    const newest = messages[messages.length - 1];
    lastCountRef.current = messages.length;

    if (!grew) return;

    if (nearBottom) {
      scrollToBottom(loading ? 'auto' : 'smooth');
    } else if (newest && newest.senderId !== me) {
      setUnseenBelow(true);
    }
  }, [messages, nearBottom, me, loading, scrollToBottom]);

  // First paint lands at the bottom without an animation.
  useEffect(() => {
    if (!loading && messages.length) scrollToBottom('auto');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const unreadIds = useMemo(
    () =>
      messages
        .filter((m) => m.senderId !== me && me && !m.readBy.includes(me))
        .map((m) => m.id),
    [messages, me],
  );

  // Debounced: the list can change several times a second while a conversation is
  // active, and each change would otherwise be its own batch commit.
  useEffect(() => {
    if (!unreadIds.length) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    const id = setTimeout(() => {
      // Already logged inside the hook; swallowed here so a failed receipt
      // doesn't surface as an error the reader can do nothing about.
      markAsRead(unreadIds).catch(() => {});
    }, MARK_READ_DEBOUNCE_MS);

    return () => clearTimeout(id);
  }, [unreadIds, markAsRead]);

  const grouped = useMemo(() => {
    const out: { day: string; items: ChatMessage[] }[] = [];
    messages.forEach((message) => {
      const day = message.timestamp ? dayLabel(message.timestamp) : 'Today';
      const last = out[out.length - 1];
      if (last?.day === day) last.items.push(message);
      else out.push({ day, items: [message] });
    });
    return out;
  }, [messages]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-white/10 flex-shrink-0">
        {onBack && (
          <button
            onClick={onBack}
            aria-label="Back to messages"
            className="lg:hidden w-9 h-9 rounded-full glass-chip flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft size={16} className="text-foreground" />
          </button>
        )}

        <Link
          href={`/app/u/${other.username}`}
          className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
        >
          {other.avatarUrl ? (
            <img src={other.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initialsOf(other.displayName)
          )}
        </Link>

        <div className="min-w-0">
          <Link
            href={`/app/u/${other.username}`}
            className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
          >
            <span className="truncate">{other.displayName}</span>
            {other.creatorStatus === 'APPROVED' && <VerifiedBadge size={13} />}
          </Link>
          <p className="text-xs text-muted-foreground truncate">@{other.username}</p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4"
      >
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`flex ${i % 2 ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`h-9 rounded-2xl bg-white/[0.06] animate-pulse ${
                    i % 3 === 0 ? 'w-32' : i % 3 === 1 ? 'w-48' : 'w-40'
                  }`}
                />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-semibold text-foreground">Chat is unavailable</p>
            <p className="text-xs text-muted-foreground mt-1">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <p className="text-sm font-semibold text-foreground">
              Say hello to {other.displayName}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This is the start of your conversation.
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.day} className="space-y-2">
              <p className="text-center text-[11px] text-muted-foreground py-1">
                {group.day}
              </p>

              {group.items.map((message) => {
                const mine = message.senderId === me;
                // Read receipts are shown on your own messages only — whether the
                // other person has seen it is the useful signal.
                const seen = mine && message.readBy.includes(other.id);

                return (
                  <div
                    key={message.id}
                    className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[78%] sm:max-w-[70%] px-3.5 py-2 rounded-2xl ${
                        mine
                          ? 'brand-gradient text-white rounded-br-md'
                          : 'glass-chip text-foreground rounded-bl-md'
                      }`}
                    >
                      {message.media && <MessageMedia media={message.media} />}
                      {message.text && <p className={`text-sm whitespace-pre-wrap break-words ${message.media ? 'mt-2' : ''}`}>{message.text}</p>}
                      <span
                        className={`mt-1 flex items-center gap-1 justify-end text-[10px] ${
                          mine ? 'text-white/70' : 'text-muted-foreground'
                        }`}
                      >
                        {timeLabel(message.timestamp)}
                        {mine &&
                          (seen ? (
                            <CheckCheck size={12} className="text-sky-300" />
                          ) : (
                            <Check size={12} />
                          ))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}

        <div ref={bottomRef} />
      </div>

      {/* Jump to newest, offered rather than forced */}
      {unseenBelow && (
        <div className="relative">
          <button
            onClick={() => scrollToBottom()}
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full brand-gradient text-white text-xs font-semibold shadow-lg hover:brightness-110 transition"
          >
            <ArrowDown size={12} />
            New message
          </button>
        </div>
      )}

      <MessageComposer
        placeholder={`Message ${other.displayName}`}
        sending={sending}
        onSend={async (text, media) => {
          setNearBottom(true);
          await sendMessage(text, media);
        }}
      />
    </div>
  );
}
