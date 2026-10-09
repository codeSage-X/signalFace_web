'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import NextLink from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  FileText,
  LayoutDashboard,
  Link2,
  Loader2,
  MoreVertical,
  Share2,
  Sparkles,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { UserAvatar } from '@/components/UserAvatar';
import { VerifiedBadge } from '@/components/VerifiedBadge';
import { BuySignalModal } from '@/components/trading/BuySignalModal';
import { PostDetailModal } from '@/components/social/PostDetailModal';
import { RealmFollowersModal } from '@/components/social/RealmFollowersModal';
import { RealmPostGrid } from '@/components/creator/RealmPostGrid';
import { externalHref, formatUsd, displayUrl } from '@/lib/utils';
import {
  realmCategoryLabel,
  realmsApi,
  type FeedPost,
  type Realm,
  type SignalListItem,
} from '@/lib/api';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth, useToast } from '@/lib/stores';

const PAGE_SIZE = 12;
const WATCHLIST_STORAGE_KEY = 'signalface.watchlist.signals';
const PROFILE_TABS = ['Overview', 'Content', 'About', 'Activity'] as const;
type ProfileTab = (typeof PROFILE_TABS)[number];

const CHART_RANGES = ['1H', '1D', '1W', '1M', '1Y', 'All'] as const;
type ChartRange = (typeof CHART_RANGES)[number];

const RANGE_MS: Record<ChartRange, number | null> = {
  '1H': 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
  All: null,
};

function compactNumber(raw: number | string | null | undefined) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return '0';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return (value / 1_000_000_000).toFixed(1) + 'B';
  if (absolute >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (absolute >= 1_000) return (value / 1_000).toFixed(1) + 'K';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function compactUsd(raw: number | string | null | undefined) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return '$0.00';
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(1) + 'B';
  if (absolute >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
  if (absolute >= 1_000) return '$' + (value / 1_000).toFixed(1) + 'K';
  return formatUsd(value);
}

function signedPercent(raw: number | string | null | undefined) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return '+0.0%';
  return (value >= 0 ? '+' : '−') + Math.abs(value).toFixed(1) + '%';
}

export default function PublicRealmPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params?.slug;
  const { user } = useAuth();
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  const [realm, setRealm] = useState<Realm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followPending, setFollowPending] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('Overview');
  const [chartRange, setChartRange] = useState<ChartRange>('1D');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [showFollowers, setShowFollowers] = useState(false);
  const [iconPreviewOpen, setIconPreviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [watchlisted, setWatchlisted] = useState(false);
  const [buyingSignal, setBuyingSignal] = useState<SignalListItem | null>(null);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    realmsApi
      .getBySlug(slug)
      .then((result) => {
        if (!cancelled) setRealm(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this Realm.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!slug) {
      setPostsLoading(false);
      return;
    }

    let cancelled = false;
    setPostsLoading(true);

    realmsApi
      .posts(slug, null, PAGE_SIZE)
      .then((page) => {
        if (cancelled) return;
        setPosts(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPostsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    const signalId = realm?.signalStats?.signalId;
    if (!signalId) return;
    try {
      const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      setWatchlisted(saved ? (JSON.parse(saved) as string[]).includes(signalId) : false);
    } catch {
      setWatchlisted(false);
    }
  }, [realm?.signal?.id, realm?.signalStats?.signalId]);

  const loadMore = useCallback(async () => {
    if (!slug || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await realmsApi.posts(slug, nextCursor, PAGE_SIZE);
      setPosts((previous) => {
        const seen = new Set(previous.map((post) => post.id));
        return [...previous, ...page.items.filter((post) => !seen.has(post.id))];
      });
      setNextCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more Realm content.', type: 'error', duration: 4000 });
    } finally {
      setLoadingMore(false);
    }
  }, [addToast, loadingMore, nextCursor, slug]);

  const handleFollow = () => {
    requireAuth(async () => {
      if (!realm || realm.isMine) return;

      setFollowPending(true);
      try {
        const result = await realmsApi.toggleFollow(realm.slug);
        setRealm((previous) => (
          previous
            ? {
                ...previous,
                isFollowedByMe: result.following,
                followersCount: result.followersCount,
              }
            : previous
        ));
        addToast({
          message: result.following ? 'Following ' + realm.name : 'Unfollowed ' + realm.name,
          type: result.following ? 'success' : 'info',
          duration: 2000,
        });
      } catch (err) {
        addToast({
          message: err instanceof Error ? err.message : 'Could not update Realm follow.',
          type: 'error',
          duration: 4000,
        });
      } finally {
        setFollowPending(false);
      }
    });
  };

  const handleShare = () => {
    void navigator.clipboard?.writeText(window.location.href);
    addToast({ message: 'Realm link copied!', type: 'info', duration: 2500 });
  };

  const toggleWatchlist = () => {
    const signalId = realm?.signalStats?.signalId;
    if (!signalId) return;

    try {
      const saved = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      const next = new Set(saved ? (JSON.parse(saved) as string[]) : []);
      if (next.has(signalId)) {
        next.delete(signalId);
        setWatchlisted(false);
        addToast({ message: 'Realm Signal removed from your watchlist.', type: 'info' });
      } else {
        next.add(signalId);
        setWatchlisted(true);
        addToast({ message: 'Realm Signal added to your watchlist.', type: 'success' });
      }
      window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      addToast({ message: 'Could not update your watchlist.', type: 'error', duration: 3000 });
    }
  };

  const buyableSignal = useMemo<SignalListItem | null>(() => {
    if (!realm?.signal || !realm.signalStats?.signalId) return null;
    return {
      id: realm.signalStats.signalId,
      title: realm.name + ' Signal',
      creatorId: realm.owner.id,
      creatorName: realm.name,
      creatorUsername: realm.owner.username,
      creatorAvatarUrl: realm.iconUrl,
      score: realm.signal.score,
      price: realm.signal.price,
      growthPct: realm.signal.growthPct,
      holdersCount: realm.signalStats?.holders ?? 0,
      lastScoredAt: realm.signal.lastScoredAt,
      createdAt: realm.createdAt,
    };
  }, [realm]);

  const chartPoints = useMemo(() => {
    const performance = realm?.signalStats?.performance ?? [];
    const windowMs = RANGE_MS[chartRange];
    const filtered = windowMs === null
      ? performance
      : performance.filter((point) => Date.now() - new Date(point.date).getTime() <= windowMs);

    return filtered.length >= 2 || performance.length < 2 ? filtered : performance;
  }, [chartRange, realm?.signalStats?.performance]);

  if (loading) return <RealmProfileSkeleton />;

  if (error || !realm) {
    return (
      <div className="min-h-full flex items-center justify-center bg-background p-6 text-foreground">
        <div className="text-center">
          <p className="font-semibold">Realm not found</p>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? 'This Realm may have been removed.'}</p>
          <NextLink
            href="/app/realms"
            className="mt-5 inline-flex rounded-xl brand-gradient px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            Browse Realms
          </NextLink>
        </div>
      </div>
    );
  }

  const signal = realm.signal;
  const stats = realm.signalStats;
  const aboutText = realm.description || realm.tagline || 'This Realm has not added an About description yet.';
  const priceChangePct = stats?.priceChangePct ?? Number(signal?.growthPct ?? 0);

  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-4 pb-12 pt-4 sm:px-6 sm:pt-6">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="relative flex items-center gap-1" ref={menuRef}>
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share Realm"
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <Share2 size={18} />
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Realm options"
              aria-expanded={menuOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <MoreVertical size={19} />
            </button>

            {menuOpen && (
              <div className="glass-card absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-2xl p-1.5 shadow-2xl">
                {realm.isMine ? (
                  <NextLink
                    href="/app/realm"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-foreground transition hover:bg-muted"
                  >
                    <LayoutDashboard size={15} />
                    Manage Realm
                  </NextLink>
                ) : (
                  <MenuAction
                    icon={followPending ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
                    onClick={() => {
                      setMenuOpen(false);
                      handleFollow();
                    }}
                  >
                    {realm.isFollowedByMe ? 'Unfollow Realm' : 'Follow Realm'}
                  </MenuAction>
                )}
                <MenuAction
                  icon={<Share2 size={15} />}
                  onClick={() => {
                    setMenuOpen(false);
                    handleShare();
                  }}
                >
                  Share Realm
                </MenuAction>
              </div>
            )}
          </div>
        </header>

        <section className="mt-5 text-center">
          <button
            type="button"
            onClick={() => realm.iconUrl && setIconPreviewOpen(true)}
            disabled={!realm.iconUrl}
            aria-label={'View ' + realm.name + ' Realm avatar'}
            className="relative mx-auto block h-28 w-28 rounded-full p-[3px] transition hover:brightness-110 disabled:cursor-default sm:h-32 sm:w-32"
          >
            <span className="absolute -inset-1 rounded-full bg-gradient-to-br from-[#ff2d9b] via-[#ff3d6e] to-[#7b2ff7] opacity-80 blur-md" />
            <span className="relative block h-full w-full rounded-full bg-gradient-to-br from-[#ff2d9b] via-[#ff3d6e] to-[#7b2ff7] p-[3px]">
              <span className="block h-full w-full overflow-hidden rounded-full bg-background p-[3px]">
                <UserAvatar src={realm.iconUrl} name={realm.name} fill ring={false} />
              </span>
            </span>
          </button>

          <div className="mt-4 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight sm:text-[1.7rem]">{realm.name}</h1>
            <VerifiedBadge size={19} />
          </div>
          <button
            type="button"
            onClick={() => setShowFollowers(true)}
            className="mt-1 text-sm text-muted-foreground transition hover:text-foreground"
          >
            {realmCategoryLabel(realm)} Creator · {compactNumber(realm.followersCount)} Followers
          </button>

          <div className="mt-3 flex items-baseline justify-center gap-2">
            <span className="text-3xl font-bold tracking-tight">{formatUsd(signal?.price ?? 0)}</span>
            <span className="text-sm font-semibold text-up">
              {signedPercent(priceChangePct)} <span className="text-muted-foreground">(24h)</span>
            </span>
          </div>
        </section>

        {buyableSignal && (
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (user?.id === realm.owner.id) {
                  addToast({ message: 'You cannot buy your own Signal.', type: 'info', duration: 3000 });
                  return;
                }
                setBuyingSignal(buyableSignal);
              }}
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-[#ec2c63] via-[#e51d69] to-[#a6165c] text-sm font-semibold text-white shadow-lg shadow-[#e51d69]/20 transition hover:brightness-110"
            >
              Buy Signal
            </button>
            <button
              type="button"
              onClick={toggleWatchlist}
              aria-label={watchlisted ? 'Remove Realm Signal from watchlist' : 'Add Realm Signal to watchlist'}
              aria-pressed={watchlisted}
              className={'flex h-11 w-11 items-center justify-center rounded-xl border transition ' + (
                watchlisted
                  ? 'border-primary/60 bg-primary/10 text-primary'
                  : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
              )}
            >
              <Star size={19} fill={watchlisted ? 'currentColor' : 'none'} />
            </button>
          </div>
        )}

        <div className="glass-card mt-5 grid grid-cols-3 divide-x divide-border overflow-hidden rounded-2xl">
          <ProfileMetric label="Market Cap" value={stats ? compactUsd(stats.marketCap) : '—'} />
          <ProfileMetric label="Signals in Circulation" value={stats ? compactNumber(stats.signalsInCirculation) : '—'} />
          <ProfileMetric label="Holders" value={stats ? compactNumber(stats.holders) : '—'} />
        </div>

        <nav className="mt-7 grid grid-cols-4 border-b border-border" role="tablist" aria-label="Realm profile sections">
          {PROFILE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className={'relative px-1 py-3 text-xs font-medium transition sm:text-sm ' + (
                activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab}
              {activeTab === tab && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </nav>

        <div className="pt-5">
          {activeTab === 'Overview' && (
            <>
              <section className="glass-card rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-foreground">Signal Performance</h2>
                </div>

                <div className="mt-4 grid grid-cols-6 gap-1 rounded-xl bg-black/25 p-1">
                  {CHART_RANGES.map((range) => (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setChartRange(range)}
                      className={'rounded-lg px-1 py-2 text-[11px] font-semibold transition sm:text-xs ' + (
                        chartRange === range
                          ? 'bg-muted text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>

                <div className="mt-4 h-52 w-full">
                  {chartPoints.length >= 2 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartPoints} margin={{ top: 8, right: 2, bottom: 0, left: -18 }}>
                        <defs>
                          <linearGradient id="public-realm-signal-stroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#a855f7" />
                            <stop offset="100%" stopColor="var(--magenta)" />
                          </linearGradient>
                          <linearGradient id="public-realm-signal-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--magenta)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="var(--magenta)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid horizontal vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={(value) => new Date(String(value)).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={28}
                        />
                        <YAxis
                          tickFormatter={(value) => compactUsd(value)}
                          tick={{ fill: 'var(--muted-foreground)', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={48}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                          contentStyle={{ backgroundColor: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, color: 'var(--popover-foreground)' }}
                          labelFormatter={(label) => new Date(String(label)).toLocaleString()}
                          formatter={(value) => [formatUsd(Number(value)), 'Signal price']}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="url(#public-realm-signal-stroke)"
                          strokeWidth={2.5}
                          fill="url(#public-realm-signal-fill)"
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--magenta)', stroke: 'var(--card)', strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
                      This Realm's Signal chart will appear as price snapshots accumulate.
                    </div>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4">
                  <ProfileMetric label="24h Volume" value={stats ? compactUsd(stats.volume24h) : '—'} compact />
                  <ProfileMetric label="24h Trades" value={stats ? compactNumber(stats.trades24h) : '—'} compact />
                  <ProfileMetric label="24h Buyers" value={stats ? compactNumber(stats.buyers24h) : '—'} compact />
                </div>
              </section>

              <section className="glass-card mt-5 rounded-2xl p-4 sm:p-5">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-foreground">About {realm.name}</h2>
                <p className={'mt-3 text-sm leading-6 text-muted-foreground ' + (aboutExpanded ? '' : 'line-clamp-4')}>{aboutText}</p>
                {aboutText.length > 150 && (
                  <button
                    type="button"
                    onClick={() => setAboutExpanded((expanded) => !expanded)}
                    className="mt-2 text-xs font-semibold text-primary hover:text-primary/80"
                  >
                    {aboutExpanded ? 'show less' : '...more'}
                  </button>
                )}
              </section>
            </>
          )}

          {activeTab === 'Content' && (
            <RealmPostGrid
              posts={posts}
              loading={postsLoading}
              nextCursor={nextCursor}
              loadingMore={loadingMore}
              onLoadMore={loadMore}
              onPostClick={setOpenIndex}
              emptyTitle="No Realm content yet"
              emptyBody={realm.name + ' has not published anything to this Realm yet.'}
              emptyAction={realm.isMine ? { href: '/app/upload?as=realm', label: 'Create the first post' } : undefined}
            />
          )}

          {activeTab === 'About' && (
            <RealmAboutPanel realm={realm} />
          )}

          {activeTab === 'Activity' && (
            <RealmActivityPanel realm={realm} priceChangePct={priceChangePct} />
          )}
        </div>

        {openIndex !== null && posts[openIndex] && (
          <PostDetailModal
            posts={posts}
            index={openIndex}
            onIndexChange={setOpenIndex}
            onClose={() => setOpenIndex(null)}
          />
        )}

        {showFollowers && (
          <RealmFollowersModal slug={realm.slug} onClose={() => setShowFollowers(false)} />
        )}

        <BuySignalModal
          signal={buyingSignal}
          onClose={() => setBuyingSignal(null)}
        />

        {iconPreviewOpen && realm.iconUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={realm.name + ' Realm avatar'}
            onClick={() => setIconPreviewOpen(false)}
          >
            <div
              className="relative h-[min(72vw,28rem)] w-[min(72vw,28rem)] overflow-hidden rounded-full bg-background ring-4 ring-primary/50 shadow-2xl shadow-primary/20"
              onClick={(event) => event.stopPropagation()}
            >
              <UserAvatar src={realm.iconUrl} name={realm.name} fill ring={false} />
              <button
                type="button"
                onClick={() => setIconPreviewOpen(false)}
                aria-label="Close Realm avatar"
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/85"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuAction({
  children,
  icon,
  onClick,
}: {
  children: ReactNode;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-muted"
    >
      {icon}
      {children}
    </button>
  );
}

function ProfileMetric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={'min-w-0 px-2 text-center ' + (compact ? 'py-0' : 'py-4 sm:py-5')}>
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">{label}</p>
      <p className={'mt-1 truncate font-bold text-foreground ' + (compact ? 'text-base sm:text-lg' : 'text-lg sm:text-xl')}>{value}</p>
    </div>
  );
}

function RealmProfileSkeleton() {
  return (
    <div className="min-h-full bg-background px-4 py-6 text-foreground sm:px-6">
      <div className="mx-auto max-w-3xl animate-pulse space-y-5">
        <div className="flex justify-between">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="h-10 w-20 rounded-full bg-muted" />
        </div>
        <div className="mx-auto h-32 w-32 rounded-full bg-muted" />
        <div className="mx-auto h-7 w-48 rounded bg-muted" />
        <div className="mx-auto h-4 w-56 rounded bg-muted" />
        <div className="h-11 w-full rounded-xl bg-muted" />
        <div className="h-24 w-full rounded-2xl bg-muted" />
        <div className="h-12 w-full rounded bg-muted" />
        <div className="h-72 w-full rounded-2xl bg-muted" />
      </div>
    </div>
  );
}

function RealmAboutPanel({ realm }: { realm: Realm }) {
  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-foreground">About {realm.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">Realm details</p>
        </div>
        <Sparkles size={17} className="text-primary" />
      </div>

      <div className="mt-5 space-y-4">
        <DetailRow label="Category" value={realmCategoryLabel(realm)} />
        <DetailRow label="Handle" value={'@' + realm.slug} />
        <DetailRow
          label="Created"
          value={new Date(realm.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
        />
        {realm.websiteUrl && (
          <div>
            <p className="text-xs text-muted-foreground">Website</p>
            <a
              href={externalHref(realm.websiteUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <Link2 size={13} />
              {displayUrl(realm.websiteUrl)}
              <ExternalLink size={11} />
            </a>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Description</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">
            {realm.description || 'This Realm has not added a description yet.'}
          </p>
        </div>
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm text-foreground">{value}</p>
    </div>
  );
}

function RealmActivityPanel({ realm, priceChangePct }: { realm: Realm; priceChangePct: number }) {
  const items = [
    {
      icon: <UserPlus size={15} />,
      title: compactNumber(realm.followersCount) + ' followers',
      detail: 'Community members following this Realm',
      tone: 'text-primary',
    },
    {
      icon: <FileText size={15} />,
      title: compactNumber(realm.postsCount) + ' posts published',
      detail: 'Content shared by this Realm',
      tone: 'text-violet',
    },
    {
      icon: <Activity size={15} />,
      title: 'Signal ' + signedPercent(priceChangePct) + ' today',
      detail: 'Realm Signal performance over 24 hours',
      tone: 'text-up',
    },
  ];

  return (
    <section className="glass-card rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Activity size={16} className="text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-foreground">Realm Activity</h2>
      </div>
      <ul className="mt-5 space-y-4">
        {items.map((item) => (
          <li key={item.title} className="flex items-center gap-3">
            <span className={'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted ' + item.tone}>
              {item.icon}
            </span>
            <span>
              <span className="block text-sm font-semibold text-foreground">{item.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{item.detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
