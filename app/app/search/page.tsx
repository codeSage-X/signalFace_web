'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Search as SearchIcon,
  X,
  Clock,
  Loader2,
  Play,
  Users as UsersIcon,
  ArrowLeft,
} from 'lucide-react';
import {
  postsApi,
  realmsApi,
  usersApi,
  REALM_CATEGORY_LABELS,
  type FeedPost,
  type FollowPerson,
  type Realm,
} from '@/lib/api';
import { useRecentSearches, useToast } from '@/lib/stores';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { ImmersiveFeed } from '@/components/feed/ImmersiveFeed';
import { PeopleYouMayKnow } from '@/components/social/PeopleYouMayKnow';

const TABS = ['Top', 'Users', 'Videos', 'Pages'] as const;
type Tab = (typeof TABS)[number];

const PAGE_SIZE = 18;
// Long enough that typing a word doesn't fire a request per letter.
const DEBOUNCE_MS = 300;

interface Results {
  users: FollowPerson[];
  posts: FeedPost[];
  realms: Realm[];
  postsCursor: string | null;
}

const EMPTY: Results = { users: [], posts: [], realms: [], postsCursor: null };

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

function SearchPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { addToast } = useToast();
  const { terms, add: rememberTerm, remove: forgetTerm, clear: clearTerms } = useRecentSearches();

  const urlQuery = params.get('q') ?? '';
  // The input is local so typing stays responsive; the URL is updated on submit
  // so a search stays shareable and survives a reload.
  const [draft, setDraft] = useState(urlQuery);
  const [query, setQuery] = useState(urlQuery);
  const [tab, setTab] = useState<Tab>('Top');
  const [results, setResults] = useState<Results>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Follow the URL when it changes underneath us (back button, a shared link).
  useEffect(() => {
    setDraft(urlQuery);
    setQuery(urlQuery);
  }, [urlQuery]);

  // Debounce so results track typing without a request per keystroke.
  useEffect(() => {
    const trimmed = draft.trim();
    if (trimmed === query) return;

    const id = setTimeout(() => setQuery(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [draft, query]);

  useEffect(() => {
    if (!query) {
      setResults(EMPTY);
      return;
    }

    let cancelled = false;
    setLoading(true);

    // All three run together: the Top tab needs every kind, and fetching them
    // per-tab would make switching tabs feel like a fresh search.
    Promise.allSettled([
      usersApi.search(query, null, PAGE_SIZE),
      postsApi.search(query, { limit: PAGE_SIZE }),
      realmsApi.list({ q: query, limit: PAGE_SIZE }),
    ])
      .then(([users, posts, realms]) => {
        if (cancelled) return;
        setResults({
          users: users.status === 'fulfilled' ? users.value.items : [],
          posts: posts.status === 'fulfilled' ? posts.value.items : [],
          realms: realms.status === 'fulfilled' ? realms.value.items : [],
          postsCursor: posts.status === 'fulfilled' ? posts.value.nextCursor : null,
        });

        if ([users, posts, realms].every((r) => r.status === 'rejected')) {
          addToast({ message: 'Search failed. Please try again.', type: 'error', duration: 4000 });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [query, addToast]);

  const submit = useCallback(
    (term: string) => {
      const value = term.trim();
      if (!value) return;
      rememberTerm(value);
      setDraft(value);
      setQuery(value);
      router.replace(`/app/search?q=${encodeURIComponent(value)}`);
      inputRef.current?.blur();
    },
    [rememberTerm, router],
  );

  const videos = results.posts.filter((p) => p.kind === 'video');
  const hasAny =
    results.users.length > 0 || results.posts.length > 0 || results.realms.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-6">
      {/* Search bar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="lg:hidden w-9 h-9 rounded-full glass-chip flex items-center justify-center flex-shrink-0"
        >
          <ArrowLeft size={16} className="text-foreground" />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(draft);
          }}
          className="relative flex-1"
        >
          <SearchIcon
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search creators, videos and pages"
            className="w-full pl-10 pr-10 py-2.5 rounded-full text-sm text-foreground placeholder-muted-foreground
              border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {draft && (
            <button
              type="button"
              onClick={() => {
                setDraft('');
                setQuery('');
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          )}
        </form>
      </div>

      {/* No query — recent searches, then who to follow */}
      {!query && (
        <div>
          {terms.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground">Recent</h2>
                <button
                  onClick={clearTerms}
                  className="text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Clear all
                </button>
              </div>
              <ul className="space-y-1">
                {terms.map((term) => (
                  <li key={term} className="flex items-center gap-3 group">
                    <button
                      onClick={() => submit(term)}
                      className="flex items-center gap-3 flex-1 min-w-0 py-2.5 text-left"
                    >
                      <span className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                        <Clock size={14} className="text-muted-foreground" />
                      </span>
                      <span className="text-sm text-foreground truncate">{term}</span>
                    </button>
                    <button
                      onClick={() => forgetTerm(term)}
                      aria-label={`Remove ${term}`}
                      className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PeopleYouMayKnow />

          {terms.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="w-16 h-16 rounded-full bg-sidebar-accent flex items-center justify-center mb-4">
                <SearchIcon size={24} className="text-muted-foreground" />
              </div>
              <p className="text-foreground font-semibold">Search Signal Face</p>
              <p className="text-muted-foreground text-sm mt-1">
                Find creators, videos and pages.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {query && (
        <>
          <div className="flex gap-1 mt-5 border-b border-white/10">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                  tab === t
                    ? 'text-foreground border-primary'
                    : 'text-muted-foreground border-transparent hover:text-foreground'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : !hasAny ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-foreground font-semibold">No results for “{query}”</p>
              <p className="text-muted-foreground text-sm mt-1">
                Try a different spelling or a shorter term.
              </p>
            </div>
          ) : (
            <div className="pt-5 space-y-8">
              {(tab === 'Top' || tab === 'Users') && results.users.length > 0 && (
                <Section title="Creators" showAll={tab === 'Top' && results.users.length > 4}
                  onShowAll={() => setTab('Users')}>
                  <ul className="space-y-1">
                    {(tab === 'Top' ? results.users.slice(0, 4) : results.users).map((person) => (
                      <UserRow key={person.id} person={person} />
                    ))}
                  </ul>
                </Section>
              )}

              {(tab === 'Top' || tab === 'Pages') && results.realms.length > 0 && (
                <Section title="Pages" showAll={tab === 'Top' && results.realms.length > 3}
                  onShowAll={() => setTab('Pages')}>
                  <ul className="space-y-1">
                    {(tab === 'Top' ? results.realms.slice(0, 3) : results.realms).map((realm) => (
                      <RealmRow key={realm.id} realm={realm} />
                    ))}
                  </ul>
                </Section>
              )}

              {(tab === 'Top' || tab === 'Videos') && (
                <Section title={tab === 'Videos' ? 'Videos' : 'Posts'}>
                  {(tab === 'Videos' ? videos : results.posts).length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      No {tab === 'Videos' ? 'videos' : 'posts'} matched this search.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {(tab === 'Videos' ? videos : results.posts).map((post) => (
                        <PostTile
                          key={post.id}
                          post={post}
                          // Index into the list the viewer will scroll, which is
                          // always the full post list — not the filtered view.
                          onOpen={() =>
                            setViewerIndex(results.posts.findIndex((p) => p.id === post.id))
                          }
                        />
                      ))}
                    </div>
                  )}
                </Section>
              )}
            </div>
          )}
        </>
      )}

      {/* Tapping a result opens the feed scoped to these results. */}
      {viewerIndex !== null && viewerIndex >= 0 && results.posts.length > 0 && (
        <div className="fixed inset-0 z-[60] bg-black">
          <ImmersiveFeed
            title={`“${query}”`}
            initialPosts={results.posts}
            initialCursor={results.postsCursor}
            initialIndex={viewerIndex}
            fetchPage={(cursor) => postsApi.search(query, { cursor, limit: PAGE_SIZE })}
            onClose={() => setViewerIndex(null)}
          />
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  children,
  showAll,
  onShowAll,
}: {
  title: string;
  children: React.ReactNode;
  showAll?: boolean;
  onShowAll?: () => void;
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {showAll && (
          <button
            onClick={onShowAll}
            className="text-xs font-semibold text-primary hover:underline"
          >
            See all
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function UserRow({ person }: { person: FollowPerson }) {
  return (
    <li>
      <NextLink
        href={`/app/u/${person.username}`}
        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-white/[0.04] transition"
      >
        <span className="w-11 h-11 rounded-full overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {person.avatarUrl ? (
            <img src={person.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initialsOf(person.displayName)
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="text-sm font-semibold text-foreground truncate">
              {person.displayName}
            </span>
            {person.creatorStatus === 'APPROVED' && <VerifiedBadge size={14} />}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            @{person.username} · {fmt(person.followersCount)} followers
          </span>
        </span>
      </NextLink>
    </li>
  );
}

function RealmRow({ realm }: { realm: Realm }) {
  return (
    <li>
      <NextLink
        href={`/app/r/${realm.slug}`}
        className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-white/[0.04] transition"
      >
        <span className="w-11 h-11 rounded-xl overflow-hidden bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          {realm.iconUrl ? (
            <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            realm.name.charAt(0).toUpperCase()
          )}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-foreground truncate">
            {realm.name}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {REALM_CATEGORY_LABELS[realm.category]} · {fmt(realm.followersCount)} followers
          </span>
        </span>
      </NextLink>
    </li>
  );
}

function PostTile({ post, onOpen }: { post: FeedPost; onOpen: () => void }) {
  const preview = post.mediaUrls[0];

  return (
    <button
      onClick={onOpen}
      className="relative rounded-lg overflow-hidden aspect-[9/16] bg-gradient-to-br from-[#1A1424] to-[#12101A] group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      {post.kind === 'video' && post.coverUrl ? (
        // The author's chosen cover, and cheaper than a <video> per tile.
        <img src={post.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : post.kind === 'video' && preview ? (
        <video
          src={preview}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : post.kind === 'image' && preview ? (
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center p-3">
          <span className="text-white text-xs font-semibold text-center leading-tight line-clamp-6">
            {post.body}
          </span>
        </span>
      )}

      <span className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />

      <span className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs font-semibold drop-shadow">
        {post.kind === 'video' ? <Play size={11} fill="currentColor" /> : <UsersIcon size={11} />}
        {fmt(post.viewCount)}
      </span>
    </button>
  );
}

export default function SearchPage() {
  // useSearchParams needs a Suspense boundary to prerender this route.
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SearchPageInner />
    </Suspense>
  );
}
