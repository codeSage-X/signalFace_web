'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Briefcase,
  LineChart,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { StatCard } from '@/components/dashboard/StatCard';
import {
  SignalMarketCard,
  compact,
  usd,
} from '@/components/dashboard/SignalMarketCard';
import {
  marketApi,
  p2pApi,
  signalsApi,
  walletApi,
  type MarketOverview,
  type P2PListing,
  type SignalListItem,
  type WalletOverview,
} from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { formatSignalFaceCoins, usdToSignalFaceCoins } from '@/lib/utils';
import { BuySignalModal } from '@/components/trading/BuySignalModal';

const P2P_PAGE_SIZE = 30;

function pctLabel(value: number) {
  if (!Number.isFinite(value)) return 'Market price';
  if (value === 0) return 'At market';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}% vs market`;
}

function ListingCard({
  listing,
  busy,
  onBuy,
}: {
  listing: P2PListing;
  busy: boolean;
  onBuy: (listing: P2PListing) => void;
}) {
  const premium = listing.spreadPct > 0;
  const discount = listing.spreadPct < 0;

  return (
    <article className="glass-card glass-hover rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/app/u/${listing.creatorUsername}`} className="flex items-center gap-3 min-w-0">
          <UserAvatar src={listing.creatorAvatarUrl} name={listing.creatorName} size="md" />
          <span className="min-w-0">
            <span className="block font-semibold text-foreground truncate">
              {listing.signalTitle}
            </span>
            <span className="block text-sm text-muted-foreground truncate">
              {listing.creatorName} · @{listing.creatorUsername}
            </span>
          </span>
        </Link>
        <span
          className={`text-xs font-semibold flex-shrink-0 ${
            discount ? 'text-up' : premium ? 'text-down' : 'text-muted-foreground'
          }`}
        >
          {pctLabel(listing.spreadPct)}
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="glass-tile rounded-xl p-3">
          <dt className="text-xs text-muted-foreground">Quantity</dt>
          <dd className="mt-1 font-bold text-foreground">
            {Number(listing.quantity).toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </dd>
        </div>
        <div className="glass-tile rounded-xl p-3">
          <dt className="text-xs text-muted-foreground">Ask Price</dt>
          <dd className="mt-1 font-bold text-primary">{usd(listing.pricePerUnit)}</dd>
        </div>
        <div className="glass-tile rounded-xl p-3">
          <dt className="text-xs text-muted-foreground">Market Price</dt>
          <dd className="mt-1 font-bold text-foreground">{usd(listing.currentSignalPrice)}</dd>
        </div>
        <div className="glass-tile rounded-xl p-3">
          <dt className="text-xs text-muted-foreground">Total</dt>
          <dd className="mt-1 font-bold text-foreground">{usd(listing.total)}</dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
        <Link href={`/app/u/${listing.sellerUsername}`} className="min-w-0 flex items-center gap-2">
          <UserAvatar src={listing.sellerAvatarUrl} name={listing.sellerName} size="sm" />
          <span className="text-xs text-muted-foreground truncate">
            Seller @{listing.sellerUsername}
          </span>
        </Link>
        <button
          type="button"
          onClick={() => onBuy(listing)}
          disabled={busy || listing.isMine}
          className="inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-2.5
            text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-60"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ShoppingBag size={15} />}
          {listing.isMine ? 'Your Listing' : 'Buy'}
        </button>
      </div>
    </article>
  );
}

function MarketPageInner() {
  const routeSearchParams = useSearchParams();
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();
  const [marketTab, setMarketTab] = useState<'signals' | 'p2p'>(
    routeSearchParams.get('tab') === 'p2p' ? 'p2p' : 'signals',
  );
  const [search, setSearch] = useState('');
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [signals, setSignals] = useState<SignalListItem[]>([]);
  const [buyingSignal, setBuyingSignal] = useState<SignalListItem | null>(null);
  const [marketLoading, setMarketLoading] = useState(true);
  const [p2pQuery, setP2pQuery] = useState('');
  const [listings, setListings] = useState<P2PListing[]>([]);
  const [myListings, setMyListings] = useState<P2PListing[]>([]);
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [p2pLoading, setP2pLoading] = useState(true);
  const [busyListingId, setBusyListingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');

  useEffect(() => {
    setMarketTab(routeSearchParams.get('tab') === 'p2p' ? 'p2p' : 'signals');
  }, [routeSearchParams]);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([marketApi.getOverview(), signalsApi.list()])
      .then(([o, s]) => {
        if (cancelled) return;
        if (o.status === 'fulfilled') setOverview(o.value);
        if (s.status === 'fulfilled') setSignals(s.value);
        if (o.status === 'rejected' && s.status === 'rejected') {
          addToast({
            message: 'Could not load the market right now.',
            type: 'error',
            duration: 4000,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setMarketLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const loadP2p = useCallback(async () => {
    const listingPage = await p2pApi.list({ q: p2pQuery, limit: P2P_PAGE_SIZE });
    setListings(listingPage.items);

    if (!isAuthenticated) {
      setWallet(null);
      setMyListings([]);
      return;
    }

    const walletResult = await walletApi.getMe();
    const mineResult = await p2pApi.mine();
    setWallet(walletResult);
    setMyListings(mineResult.items);
  }, [isAuthenticated, p2pQuery]);

  useEffect(() => {
    let cancelled = false;
    setP2pLoading(true);

    loadP2p()
      .catch((err) => {
        if (cancelled) return;
        addToast({
          message: err instanceof Error ? err.message : 'Could not load P2P listings.',
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) setP2pLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [addToast, loadP2p]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return signals;
    return signals.filter(
      (s) =>
        s.creatorName.toLowerCase().includes(q) ||
        s.creatorUsername.toLowerCase().includes(q),
    );
  }, [signals, search]);

  const holdings = wallet?.holdings ?? [];
  const selectedHolding = holdings.find((holding) => holding.signalId === selectedSignalId);
  const availableBalance = Number(wallet?.pointsBalance ?? 0);
  const activeMine = useMemo(
    () => myListings.filter((listing) => listing.status === 'ACTIVE'),
    [myListings],
  );

  useEffect(() => {
    if (!selectedHolding) return;
    if (!pricePerUnit) setPricePerUnit(selectedHolding.currentPrice);
  }, [pricePerUnit, selectedHolding]);

  const refreshSignals = () =>
    signalsApi
      .list()
      .then(setSignals)
      .catch(() => {});

  const createListing = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    const qty = Number(quantity);
    const price = Number(pricePerUnit);
    if (!selectedSignalId || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) {
      addToast({ message: 'Select a holding, quantity, and price.', type: 'error', duration: 3500 });
      return;
    }

    setCreating(true);
    try {
      await p2pApi.create({ signalId: selectedSignalId, quantity: qty, pricePerUnit: price });
      setQuantity('');
      setPricePerUnit('');
      await loadP2p();
      addToast({ message: 'P2P listing is live.', type: 'success', duration: 3500 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not create listing.',
        type: 'error',
        duration: 4500,
      });
    } finally {
      setCreating(false);
    }
  };

  const buyListing = async (listing: P2PListing) => {
    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    setBusyListingId(listing.id);
    try {
      await p2pApi.buy(listing.id, {});
      await loadP2p();
      addToast({
        message: `You bought ${Number(listing.quantity).toLocaleString()} ${listing.signalTitle}.`,
        type: 'success',
        duration: 3500,
      });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not buy listing.',
        type: 'error',
        duration: 4500,
      });
    } finally {
      setBusyListingId(null);
    }
  };

  const cancelListing = async (listing: P2PListing) => {
    setBusyListingId(listing.id);
    try {
      await p2pApi.cancel(listing.id);
      await loadP2p();
      addToast({ message: 'Listing canceled and Signal returned.', type: 'success', duration: 3500 });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not cancel listing.',
        type: 'error',
        duration: 4500,
      });
    } finally {
      setBusyListingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Marketplace</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Discover creator Signals or trade directly with other users.
        </p>
      </div>

      <div
        className="relative grid grid-cols-2 overflow-hidden border-b border-white/10 bg-white/[0.03] shadow-lg shadow-black/20"
        role="tablist"
        aria-label="Marketplace sections"
      >
        <span
          aria-hidden
          className={`absolute inset-y-0 left-0 w-1/2 bg-primary/10 transition-transform duration-300 ease-out ${
            marketTab === 'p2p' ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        <span
          aria-hidden
          className={`absolute bottom-0 left-0 h-0.5 w-1/2 bg-primary transition-transform duration-300 ease-out ${
            marketTab === 'p2p' ? 'translate-x-full' : 'translate-x-0'
          }`}
        />
        {(['signals', 'p2p'] as const).map((nextTab) => (
          <button
            key={nextTab}
            type="button"
            role="tab"
            aria-selected={marketTab === nextTab}
            onClick={() => setMarketTab(nextTab)}
            className={`relative z-10 flex items-center justify-center px-3 py-4 text-sm font-semibold uppercase tracking-wide transition-colors ${
              marketTab === nextTab
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {nextTab === 'signals' ? 'Signals' : 'P2P'}
          </button>
        ))}
      </div>

      {marketTab === 'signals' ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <StatCard
              label="Active Signals"
              value={overview?.totalSignals ?? signals.length}
              icon={TrendingUp}
            />
            <StatCard label="Market Cap" value={compact(overview?.totalMarketValue ?? 0)} />
            <StatCard label="24h Volume" value={compact(overview?.tradingVolume24h ?? 0)} />
            <StatCard
              label="Traders"
              value={(overview?.activeTraders ?? 0).toLocaleString()}
            />
          </div>

          <div className="relative">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search signals by creator name or handle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-foreground placeholder-muted-foreground
                glass-card border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4">
              Available Signals
              {!marketLoading && filtered.length !== signals.length && ` (${filtered.length})`}
            </h2>

            {marketLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 size={22} className="animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
                <LineChart size={28} className="mx-auto text-muted-foreground" />
                <p className="mt-3 font-semibold text-card-foreground">
                  {search ? 'No signals match that search' : 'No signals listed yet'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search
                    ? 'Try a different creator name or handle.'
                    : 'A Signal is created when a creator is approved.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
                {filtered.map((signal) => (
                  <SignalMarketCard key={signal.id} signal={signal} onTrade={setBuyingSignal} />
                ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex justify-end">
            <div className="glass-chip rounded-xl px-4 py-2.5 text-sm text-muted-foreground">
              Available to trade{' '}
              <span className="font-bold text-foreground">
                {formatSignalFaceCoins(usdToSignalFaceCoins(availableBalance))}
              </span>
              <span className="ml-1">({usd(availableBalance)} equivalent)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_22rem] gap-4 lg:gap-5">
            <section className="space-y-4">
              <div className="relative">
                <Search
                  size={17}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  value={p2pQuery}
                  onChange={(event) => setP2pQuery(event.target.value)}
                  placeholder="Search listings by Signal, creator, or seller..."
                  className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm text-foreground placeholder-muted-foreground
                    glass-card border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {p2pLoading ? (
                <div className="flex justify-center py-16">
                  <Loader2 size={22} className="animate-spin text-muted-foreground" />
                </div>
              ) : listings.length === 0 ? (
                <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
                  <ShoppingBag size={28} className="mx-auto text-muted-foreground" />
                  <p className="mt-3 font-semibold text-card-foreground">No P2P listings yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Be the first to list a Signal from your holdings.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                  {listings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      busy={busyListingId === listing.id}
                      onBuy={buyListing}
                    />
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-4">
              <section className="glass-card rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={18} className="text-primary" />
                  <h2 className="text-lg font-bold text-foreground">Sell a Signal</h2>
                </div>

                {!isAuthenticated ? (
                  <button
                    type="button"
                    onClick={() => setAuthModalOpen(true)}
                    className="w-full rounded-xl brand-gradient px-4 py-3 text-sm font-semibold text-white"
                  >
                    Sign in to sell
                  </button>
                ) : holdings.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    You do not have any available Signals to list.
                    <button
                      type="button"
                      onClick={() => setMarketTab('signals')}
                      className="block mt-3 text-primary font-semibold hover:underline"
                    >
                      Browse Signals
                    </button>
                  </div>
                ) : (
                  <form onSubmit={createListing} className="space-y-3">
                    <select
                      value={selectedSignalId}
                      onChange={(event) => {
                        const holding = holdings.find((h) => h.signalId === event.target.value);
                        setSelectedSignalId(event.target.value);
                        setPricePerUnit(holding?.currentPrice ?? '');
                      }}
                      className="w-full px-3 py-3 rounded-xl glass-input text-sm text-foreground"
                    >
                      <option value="">Select holding</option>
                      {holdings.map((holding) => (
                        <option key={holding.signalId} value={holding.signalId}>
                          {holding.creatorName} · {Number(holding.quantity).toLocaleString()} available
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder="Quantity to sell"
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                    />
                    <input
                      type="number"
                      min="0.0001"
                      step="0.0001"
                      value={pricePerUnit}
                      onChange={(event) => setPricePerUnit(event.target.value)}
                      placeholder="Price per Signal"
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                    />
                    {selectedHolding && (
                      <p className="text-xs text-muted-foreground">
                        Market price is {usd(selectedHolding.currentPrice)}. Listing reserves the
                        quantity until it sells or you cancel.
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-3
                        text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-70"
                    >
                      {creating ? <Loader2 size={16} className="animate-spin" /> : <Tag size={16} />}
                      Create Listing
                    </button>
                  </form>
                )}
              </section>

              <section className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Briefcase size={18} className="text-primary" />
                    <h2 className="text-lg font-bold text-foreground">Your Listings</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadP2p()}
                    className="h-8 w-8 rounded-lg glass-chip flex items-center justify-center hover:brightness-125 transition"
                    aria-label="Refresh P2P listings"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>

                {!isAuthenticated ? (
                  <p className="text-sm text-muted-foreground">Sign in to manage your listings.</p>
                ) : activeMine.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active listings.</p>
                ) : (
                  <ul className="space-y-2">
                    {activeMine.map((listing) => (
                      <li key={listing.id} className="glass-tile rounded-xl p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {listing.signalTitle}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {Number(listing.quantity).toLocaleString(undefined, {
                                maximumFractionDigits: 4,
                              })}{' '}
                              @ {usd(listing.pricePerUnit)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => cancelListing(listing)}
                            disabled={busyListingId === listing.id}
                            className="text-xs font-semibold text-primary hover:underline disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        </>
      )}

      <BuySignalModal
        signal={buyingSignal}
        onClose={() => setBuyingSignal(null)}
        onPurchased={refreshSignals}
      />
    </div>
  );
}

export default function MarketPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      }
    >
      <MarketPageInner />
    </Suspense>
  );
}
