'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2, MapPin, MessageCircle, Plus, Search, ShoppingBag, Store } from 'lucide-react';
import {
  marketApi, type MarketplaceCategory, type MarketplaceListing, type MarketplaceOrder,
  type MarketplaceOrderInput, type MarketplaceOrderStatus, type MarketplaceShopType,
  type MarketplaceStorefront,
} from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { useMarketplacePage } from '@/hooks/useMarketplacePage';
import { ProductCard } from '@/components/market/ProductCard';
import { ProductDetail } from '@/components/market/ProductDetail';
import { SellModal } from '@/components/market/SellModal';
import { ShopRegistration } from '@/components/market/ShopRegistration';
import { OrderCard } from '@/components/market/OrderCard';
import { CATEGORIES, SHOP_TYPES, messageHref, money, shopTypeLabel } from '@/components/market/market-utils';

const VIEWS = [
  { value: 'browse', label: 'Items' }, { value: 'shops', label: 'Shops' },
  { value: 'orders', label: 'My orders' }, { value: 'selling', label: 'My shop' },
] as const;
type View = typeof VIEWS[number]['value'];

function Loading() { return <div className="flex justify-center py-16" role="status" aria-label="Loading"><Loader2 className="animate-spin text-primary" /></div>; }
function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div role="alert" className="my-5 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>{message}</p><button onClick={onRetry} className="mt-2 font-semibold text-primary">Try again</button></div>;
}
function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{children}</p>;
}

function MarketPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const shopId = params.get('shop');
  const { user, isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();
  const [view, setView] = useState<View>('browse');
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [category, setCategory] = useState<MarketplaceCategory | ''>('');
  const [shopType, setShopType] = useState<MarketplaceShopType | ''>('');
  const [storefront, setStorefront] = useState<MarketplaceStorefront | null>(null);
  const [storefrontLoading, setStorefrontLoading] = useState(false);
  const [storefrontError, setStorefrontError] = useState('');
  const [myShop, setMyShop] = useState<MarketplaceStorefront | null>(null);
  const [mine, setMine] = useState<MarketplaceListing[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [incoming, setIncoming] = useState<MarketplaceOrder[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
  const [detailError, setDetailError] = useState('');
  const [sellOpen, setSellOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const actionPending = useRef(false);
  const selectionRequest = useRef(0);

  const fetchListings = useCallback((cursor?: string) => {
    if (view !== 'browse' && !shopId) return Promise.resolve({ items: [], nextCursor: null });
    return marketApi.listProducts({ q: submittedQuery, category, shopType: shopId ? '' : shopType, shopId: shopId ?? undefined, limit: 30, cursor });
  }, [submittedQuery, category, shopType, shopId, view, revision, user?.id]);
  const products = useMarketplacePage(fetchListings);
  const fetchShops = useCallback((cursor?: string) => {
    if (view !== 'shops' || shopId) return Promise.resolve({ items: [], nextCursor: null });
    return marketApi.listShops({ q: submittedQuery, shopType, cursor });
  }, [view, shopId, submittedQuery, shopType, revision, user?.id]);
  const shops = useMarketplacePage(fetchShops);

  useEffect(() => {
    setQuery(''); setSubmittedQuery(''); setCategory('');
    if (shopId) setView('browse');
  }, [shopId]);
  useEffect(() => {
    let cancelled = false;
    setStorefront(null); setStorefrontError('');
    if (!shopId) { setStorefrontLoading(false); return; }
    setStorefrontLoading(true);
    marketApi.getShop(shopId).then((shop) => { if (!cancelled) setStorefront(shop); })
      .catch((err) => { if (!cancelled) setStorefrontError(err instanceof Error ? err.message : 'Could not load shop.'); })
      .finally(() => { if (!cancelled) setStorefrontLoading(false); });
    return () => { cancelled = true; };
  }, [shopId, revision, user?.id]);
  useEffect(() => {
    let cancelled = false;
    setMine([]); setOrders([]); setIncoming([]); setActivityError('');
    if (!isAuthenticated || (view !== 'orders' && view !== 'selling')) { setActivityLoading(false); return; }
    setActivityLoading(true);
    async function load() {
      try {
        if (view === 'orders') {
          const result = await marketApi.myOrders();
          if (!cancelled) setOrders(result.items);
        } else {
          const shop = await marketApi.myShop();
          if (cancelled) return;
          setMyShop(shop);
          if (shop) {
            const listings = await marketApi.myProducts();
            if (cancelled) return;
            setMine(listings.items);
          }
          // Existing sellers can still resolve orders while registering their shop.
          const sales = await marketApi.sellerOrders();
          if (!cancelled) setIncoming(sales.items);
        }
      } catch (err) { if (!cancelled) setActivityError(err instanceof Error ? err.message : 'Could not load activity.'); }
      finally { if (!cancelled) setActivityLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id, view, revision]);
  useEffect(() => { setMyShop(null); setSellOpen(false); setRegisterOpen(false); }, [user?.id]);
  useEffect(() => () => { selectionRequest.current++; }, []);

  const refresh = () => setRevision((value) => value + 1);
  const toastError = (error: unknown) => addToast({ message: error instanceof Error ? error.message : 'Something went wrong. Please try again.', type: 'error', duration: 4500 });
  function changeView(next: View) {
    if ((next === 'orders' || next === 'selling') && !isAuthenticated) { setAuthModalOpen(true); return; }
    if (shopId) router.push('/app/market');
    setView(next); setQuery(''); setSubmittedQuery(''); setCategory('');
  }
  function openShop(id: string) { selectionRequest.current++; setSelected(null); router.push(`/app/market?shop=${encodeURIComponent(id)}`); }
  function message(username: string) {
    selectionRequest.current++; setSelected(null);
    if (!isAuthenticated) { setAuthModalOpen(true); return; }
    router.push(messageHref(username));
  }
  async function openProduct(listing: MarketplaceListing) {
    const request = ++selectionRequest.current;
    setDetailError(''); setSelected(listing);
    try {
      const fresh = await marketApi.getProduct(listing.id);
      if (request === selectionRequest.current) setSelected(fresh);
    } catch (err) { if (request === selectionRequest.current) setDetailError(err instanceof Error ? err.message : 'Could not refresh this item.'); }
  }
  async function openSell() {
    if (!isAuthenticated) { setAuthModalOpen(true); return; }
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true);
    try {
      const shop = await marketApi.myShop(); setMyShop(shop);
      if (shop) setSellOpen(true); else setRegisterOpen(true);
    } catch (err) { toastError(err); }
    finally { actionPending.current = false; setBusy(false); }
  }
  async function buy(input: MarketplaceOrderInput) {
    if (!isAuthenticated) { selectionRequest.current++; setSelected(null); setAuthModalOpen(true); return; }
    if (!selected || actionPending.current) return;
    actionPending.current = true; setBusy(true); setDetailError(''); selectionRequest.current++;
    try {
      await marketApi.buyProduct(selected.id, input);
      setSelected(null); if (shopId) router.push('/app/market'); setView('orders'); refresh();
      addToast({ message: 'Order placed. Open Messenger from your order to arrange the details.', type: 'success', duration: 4500 });
    } catch (err) { setDetailError(err instanceof Error ? err.message : 'Could not place order.'); }
    finally { actionPending.current = false; setBusy(false); }
  }
  async function updateProduct(change: () => Promise<MarketplaceListing>) {
    if (actionPending.current) return;
    actionPending.current = true; setBusy(true); setDetailError(''); selectionRequest.current++;
    try {
      const updated = await change(); setSelected(updated); refresh();
    } catch (err) { setDetailError(err instanceof Error ? err.message : 'Could not update listing.'); }
    finally { actionPending.current = false; setBusy(false); }
  }
  async function updateOrder(id: string, status: Exclude<MarketplaceOrderStatus, 'PENDING'>) {
    if (actionPending.current) return;
    if (status === 'COMPLETED' && !window.confirm('Confirm that this order has been handed over and payment is settled?')) return;
    if (status === 'CANCELED' && !window.confirm('Cancel this order and return its reserved items to available stock?')) return;
    actionPending.current = true; setBusy(true);
    try { await marketApi.setOrderStatus(id, status); refresh(); }
    catch (err) { toastError(err); }
    finally { actionPending.current = false; setBusy(false); }
  }
  const isCatalog = !!shopId || view === 'browse' || view === 'shops';
  const catalog = view === 'shops' && !shopId ? shops : products;

  return (
    <div className="mx-auto max-w-[1440px] overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="flex flex-wrap items-center justify-between gap-4 lg:pr-52">
        <div className="min-w-0"><h1 className="text-2xl font-bold sm:text-3xl">Shopping Mall</h1><p className="mt-1 text-sm text-muted-foreground">Discover plazas, stores, and supermarkets in your community.</p></div>
        <button type="button" disabled={busy} onClick={openSell} className="brand-gradient flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"><Plus size={17} /> Sell an item</button>
      </header>
      <nav aria-label="Shopping Mall" className="mt-6 flex gap-5 overflow-x-auto border-b border-border">
        {VIEWS.map((item) => <button key={item.value} type="button" onClick={() => changeView(item.value)} aria-current={!shopId && view === item.value ? 'page' : undefined} className={`shrink-0 border-b-2 px-1 pb-3 text-sm font-semibold ${!shopId && view === item.value ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'}`}>{item.label}</button>)}
      </nav>
      {shopId && <section className="mt-5">
        <Link href="/app/market" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft size={16} /> Back to Shopping Mall</Link>
        {storefrontLoading ? <Loading /> : storefrontError ? <ErrorNotice message={storefrontError} onRetry={refresh} /> : storefront && <div className="rounded-xl border border-border bg-card p-5">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{shopTypeLabel(storefront.type)}</span>
          <h2 className="mt-3 text-2xl font-bold">{storefront.name}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{storefront.description}</p>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted-foreground"><MapPin size={14} /> {storefront.location} · {storefront.availableListings} available listings</p>
          {!storefront.isMine && <button onClick={() => message(storefront.owner.username)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary"><MessageCircle size={16} /> Chat with seller</button>}
        </div>}
      </section>}
      {isCatalog && <>
        <form onSubmit={(event) => { event.preventDefault(); setSubmittedQuery(query.trim()); }} className="mt-5 flex gap-2">
          <div className="relative min-w-0 flex-1"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input aria-label="Search Shopping Mall" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={view === 'shops' ? 'Search shops or locations' : 'Search items or locations'} className="glass-input h-11 w-full rounded-lg pl-10 pr-3 text-sm" /></div>
          <button type="submit" aria-label="Search" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"><Search size={18} /></button>
        </form>
        {!shopId && <div className="mt-3 flex flex-wrap gap-2">
          {[{ value: '', label: 'All shops' }, ...SHOP_TYPES].map((item) => <button key={item.value} onClick={() => setShopType(item.value as MarketplaceShopType | '')} className={`rounded-full border px-3 py-2 text-xs font-semibold ${shopType === item.value ? 'border-primary bg-primary text-white' : 'border-border text-muted-foreground'}`}>{item.label}</button>)}
        </div>}
        {(view !== 'shops' || shopId) && <div className="mt-3 flex gap-2 overflow-x-auto pb-2">{CATEGORIES.map((item) => <button key={item.value} onClick={() => setCategory(item.value)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold ${category === item.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>{item.label}</button>)}</div>}
        <h2 className="mt-6 mb-4 font-bold">{submittedQuery ? `Results for “${submittedQuery}”` : view === 'shops' && !shopId ? 'Find your next favourite shop' : shopId ? 'Available items' : 'Fresh finds'}</h2>
        {catalog.error && <ErrorNotice message={catalog.error} onRetry={catalog.refresh} />}
        {catalog.loading ? <Loading /> : view === 'shops' && !shopId ? (
          shops.items.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{shops.items.map((shop) => <button key={shop.id} onClick={() => openShop(shop.id)} className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/50">
            <span className="flex items-center justify-between gap-2"><Store size={24} className="text-primary" /><span className="rounded-full bg-muted px-2 py-1 text-xs">{shopTypeLabel(shop.type)}</span></span>
            <h3 className="mt-3 truncate text-lg font-bold">{shop.name}</h3><p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{shop.description}</p><p className="mt-4 text-xs text-muted-foreground">{shop.location} · {shop.availableListings} available listings</p>
          </button>)}</div> : !shops.error && <Empty>No shops match this search. Try another name or account type.</Empty>
        ) : products.items.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{products.items.map((listing) => <ProductCard key={listing.id} listing={listing} onOpen={() => void openProduct(listing)} />)}</div> : !products.error && <Empty>No available items found. Try another search or visit again soon.</Empty>}
        {catalog.nextCursor && <button onClick={() => void catalog.loadMore()} disabled={catalog.loadingMore} className="mx-auto mt-6 block rounded-lg border border-border px-5 py-3 text-sm font-semibold disabled:opacity-50">{catalog.loadingMore ? 'Loading…' : 'Show more'}</button>}
      </>}
      {!isCatalog && (!isAuthenticated ? <button onClick={() => setAuthModalOpen(true)} className="mt-6 rounded-lg border border-primary p-4 text-primary">Sign in to view your Shopping Mall account</button> : activityLoading ? <Loading /> : activityError ? <ErrorNotice message={activityError} onRetry={refresh} /> : <div className="mt-6 space-y-8">
        <div className="flex justify-end"><button type="button" onClick={refresh} disabled={busy} className="text-sm font-semibold text-primary disabled:opacity-50">Refresh activity</button></div>
        {view === 'orders' ? <section><h2 className="mb-4 flex items-center gap-2 font-bold"><ShoppingBag size={19} /> My orders</h2>{orders.length ? <div className="grid gap-4 lg:grid-cols-2">{orders.map((order) => <OrderCard key={order.id} order={order} busy={busy} onStatus={updateOrder} onMessage={message} onOpen={() => void openProduct(order.listing)} />)}</div> : <Empty>Your orders will appear here. Browse items to place your first order.</Empty>}</section> : <>
          {myShop ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-5"><div><p className="text-xs font-semibold text-primary">{shopTypeLabel(myShop.type)}</p><h2 className="mt-1 text-xl font-bold">{myShop.name}</h2><p className="mt-1 text-sm text-muted-foreground">{myShop.location}</p></div><button onClick={() => openShop(myShop.id)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">View storefront</button></div> : <div className="rounded-xl border border-primary/30 bg-primary/5 p-6"><h2 className="text-xl font-bold">Start selling in Shopping Mall</h2><p className="mt-2 text-sm text-muted-foreground">Create a Plaza, Store, or Supermarket account before publishing your items.</p><button onClick={() => setRegisterOpen(true)} className="brand-gradient mt-4 rounded-lg px-4 py-3 text-sm font-semibold text-white">Create seller account</button></div>}
          <section><h2 className="mb-4 font-bold">Incoming orders</h2><p className="mb-4 text-sm text-muted-foreground">Chat with each buyer to agree on delivery or pickup. Mark completed after handover and payment.</p>{incoming.length ? <div className="grid gap-4 lg:grid-cols-2">{incoming.map((order) => <OrderCard key={order.id} order={order} selling busy={busy} onStatus={updateOrder} onMessage={message} onOpen={() => void openProduct(order.listing)} />)}</div> : <Empty>Orders from your customers will appear here.</Empty>}</section>
          {myShop && <section><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Your listings</h2><button onClick={openSell} disabled={busy} className="text-sm font-semibold text-primary">Add item</button></div>{mine.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{mine.map((listing) => <button key={listing.id} onClick={() => void openProduct(listing)} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left"><img src={listing.imageUrls[0]} alt="" className="h-16 w-16 rounded-lg object-cover" /><span className="min-w-0"><span className="block truncate font-semibold">{listing.title}</span><span className="mt-1 block text-xs text-muted-foreground">{money(listing.price)} · {listing.stockQuantity} in stock</span><span className="mt-1 block text-xs capitalize text-primary">{listing.status.toLowerCase()}</span></span></button>)}</div> : <Empty>Your shop is ready. Add your first item to start selling.</Empty>}</section>}
        </>}
      </div>)}
      {selected && <ProductDetail key={selected.id} listing={selected} busy={busy} error={detailError} onClose={() => { selectionRequest.current++; setSelected(null); }} onBuy={buy} onStatus={(status) => void updateProduct(() => marketApi.setProductStatus(selected.id, status))} onStock={(quantity) => void updateProduct(() => marketApi.setStock(selected.id, quantity))} onMessage={message} onShop={openShop} onSelect={(listing) => void openProduct(listing)} />}
      {registerOpen && <ShopRegistration onClose={() => setRegisterOpen(false)} onCreated={(shop) => { setMyShop(shop); setRegisterOpen(false); setSellOpen(true); refresh(); }} />}
      {sellOpen && myShop && <SellModal shop={myShop} onClose={() => setSellOpen(false)} onCreated={() => { setSellOpen(false); if (shopId) router.push('/app/market'); setView('selling'); refresh(); }} />}
    </div>
  );
}

export default function MarketPage() { return <Suspense fallback={<Loading />}><MarketPageInner /></Suspense>; }
