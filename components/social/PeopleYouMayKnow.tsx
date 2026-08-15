'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import { Loader2, UserPlus, Check } from 'lucide-react';
import { usersApi, type FollowPerson } from '@/lib/api';
import { useToast } from '@/lib/stores';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { VerifiedBadge } from '@/components/VerifiedBadge';

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

/**
 * Accounts the viewer might want to follow, ranked server-side by mutual follows.
 *
 * Laid out as a horizontal card rail — the shape TikTok and Instagram both use,
 * because it suggests "skim past these" rather than "work through this list".
 */
export function PeopleYouMayKnow({ limit = 10 }: { limit?: number }) {
  const { addToast } = useToast();
  const { requireAuth } = useRequireAuth();

  const [people, setPeople] = useState<FollowPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  // Dismissed locally only: the ranking is recomputed server-side each visit, so
  // persisting this would mean storing a growing "never show" list for little gain.
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    usersApi
      .suggestions(limit)
      .then((res) => {
        if (!cancelled) setPeople(res.items);
      })
      // A failed suggestion rail is not worth interrupting anyone over — it just
      // doesn't render.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  const handleFollow = (person: FollowPerson) => {
    requireAuth(async () => {
      if (pending) return;
      setPending(person.username);

      // Optimistic, so the button confirms immediately.
      setPeople((prev) =>
        prev.map((p) => (p.id === person.id ? { ...p, isFollowedByMe: true } : p)),
      );

      try {
        const res = await usersApi.toggleFollow(person.username);
        setPeople((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, isFollowedByMe: res.following } : p)),
        );
      } catch (err) {
        setPeople((prev) =>
          prev.map((p) => (p.id === person.id ? { ...p, isFollowedByMe: false } : p)),
        );
        addToast({
          message: err instanceof Error ? err.message : 'Could not follow that account.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setPending(null);
      }
    });
  };

  const visible = people.filter((p) => !dismissed.has(p.id));

  if (loading) {
    return (
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-foreground mb-3">People you may know</h2>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="w-36 flex-shrink-0 rounded-2xl bg-white/[0.04] animate-pulse h-48"
            />
          ))}
        </div>
      </section>
    );
  }

  // Nothing to suggest is a normal state on a small or brand-new network.
  if (visible.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold text-foreground mb-3">People you may know</h2>

      <div
        className="flex gap-3 overflow-x-auto snap-x pb-2 -mx-1 px-1
          [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((person) => (
          <div
            key={person.id}
            className="relative w-36 flex-shrink-0 snap-start rounded-2xl border border-white/10 bg-white/[0.03] p-3 flex flex-col items-center text-center"
          >
            <button
              onClick={() => setDismissed((prev) => new Set(prev).add(person.id))}
              aria-label={`Dismiss ${person.displayName}`}
              className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 flex items-center justify-center text-xs leading-none"
            >
              ×
            </button>

            <NextLink href={`/app/u/${person.username}`} className="flex flex-col items-center">
              <span className="w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-sm font-bold mt-1">
                {person.avatarUrl ? (
                  <img src={person.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  initialsOf(person.displayName)
                )}
              </span>

              <span className="flex items-center gap-1 mt-2 max-w-full">
                <span className="text-xs font-semibold text-foreground truncate">
                  {person.displayName}
                </span>
                {person.creatorStatus === 'APPROVED' && <VerifiedBadge size={12} />}
              </span>
              <span className="block text-[11px] text-muted-foreground truncate max-w-full">
                {fmt(person.followersCount)} followers
              </span>
            </NextLink>

            <button
              onClick={() => handleFollow(person)}
              disabled={pending === person.username || person.isFollowedByMe}
              className={`mt-3 w-full py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition disabled:opacity-70 ${
                person.isFollowedByMe
                  ? 'glass-chip text-foreground'
                  : 'brand-gradient text-white hover:brightness-110'
              }`}
            >
              {pending === person.username ? (
                <Loader2 size={11} className="animate-spin" />
              ) : person.isFollowedByMe ? (
                <>
                  <Check size={11} strokeWidth={3} />
                  Following
                </>
              ) : (
                <>
                  <UserPlus size={11} />
                  Follow
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
