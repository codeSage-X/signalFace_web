'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, MessageCircle, Package, ShoppingBag, Store } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { marketApi, type MarketplaceFulfillment, type MarketplaceListing, type MarketplaceOrderInput } from '@/lib/api';
import { MallDialog } from './MallDialog';
import { ProductCard } from './ProductCard';
import { categoryLabel, conditionLabel, money, shopTypeLabel } from './market-utils';

export function ProductDetail({ listing, busy, error, onClose, onBuy, onStatus, onStock, onMessage, onShop, onSelect }: {
  listing: MarketplaceListing; busy: boolean; error: string; onClose: () => void;
  onBuy: (input: MarketplaceOrderInput) => void;
  onStatus: (status: 'ACTIVE' | 'SOLD' | 'CANCELED') => void;
  onStock: (quantity: number) => void;
onMessage: (username: string, draft: string) => void;
  onShop: (id: string) => void;
  onSelect: (listing: MarketplaceListing) => void;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const [note, setNote] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [stock, setStock] = useState(listing.stockQuantity);
  const [fulfillment, setFulfillment] = useState<MarketplaceFulfillment>('PICKUP');
  const [related, setRelated] = useState<MarketplaceListing[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [relatedError, setRelatedError] = useState('');
  useEffect(() => { setStock(listing.stockQuantity); }, [listing.stockQuantity]);
  useEffect(() => {
    let cancelled = false;
    if (!listing.shop) { setRelatedLoading(false); return; }
    setRelatedLoading(true); setRelatedError('');
    marketApi.listProducts({ shopId: listing.shop.id, limit: 5 })
      .then((page) => { if (!cancelled) setRelated(page.items.filter((item) => item.id !== listing.id).slice(0, 4)); })
      .catch(() => { if (!cancelled) setRelatedError('Could not load other items. Open the shop to try again.'); })
      .finally(() => { if (!cancelled) setRelatedLoading(false); });
    return () => { cancelled = true; };
  }, [listing.id, listing.shop?.id]);
  const available = listing.status === 'ACTIVE' && listing.stockQuantity > 0;
  return (
    <MallDialog title={listing.title} busy={busy} onClose={onClose} wide>
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/95 p-3 backdrop-blur">
        <button type="button" disabled={busy} onClick={onClose} aria-label="Close product" className="rounded-full p-2 hover:bg-muted"><ArrowLeft size={20} /></button>
        <span className="truncate text-sm font-semibold">Marketplace · {listing.shop?.name ?? 'Your listing'}</span>
      </header>
      <div className="lg:grid lg:grid-cols-[1.2fr_1fr]">
        <section className="relative flex min-h-64 items-center justify-center bg-black lg:sticky lg:top-16 lg:self-start">
          {listing.imageUrls[imageIndex] ? <img src={listing.imageUrls[imageIndex]} alt={listing.title} className="max-h-[60dvh] w-full object-contain" /> : <Package size={40} className="text-white/60" />}
          {listing.imageUrls.length > 1 && <>
            <button type="button" onClick={() => setImageIndex((imageIndex - 1 + listing.imageUrls.length) % listing.imageUrls.length)} aria-label="Previous photo" className="absolute left-3 top-1/2 rounded-full bg-black/65 p-2 text-white"><ChevronLeft /></button>
            <button type="button" onClick={() => setImageIndex((imageIndex + 1) % listing.imageUrls.length)} aria-label="Next photo" className="absolute right-3 top-1/2 rounded-full bg-black/65 p-2 text-white"><ChevronRight /></button>
            <span className="absolute bottom-3 rounded-full bg-black/65 px-3 py-1 text-xs text-white">{imageIndex + 1} / {listing.imageUrls.length}</span>
          </>}
        </section>
        <section className="min-w-0 space-y-6 p-5 sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">{categoryLabel(listing.category)}</p>
            <h1 className="mt-1 text-2xl font-bold">{listing.title}</h1>
            <p className="mt-2 text-3xl font-bold">{money(listing.price)}</p>
            {listing.negotiable && <p className="mt-1 text-sm text-primary">Price is negotiable</p>}
            <p className="mt-2 text-sm font-semibold">{available ? `${listing.stockQuantity.toLocaleString()} in stock` : listing.status === 'RESERVED' ? 'All available stock is reserved' : 'Currently unavailable'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3 text-sm">
            <div><dt className="text-muted-foreground">Condition</dt><dd className="mt-1 font-semibold">{conditionLabel(listing.condition)}</dd></div>
            <div><dt className="text-muted-foreground">Location</dt><dd className="mt-1 font-semibold">{listing.location}</dd></div>
          </dl>
          <div><h2 className="font-bold">Description</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{listing.description}</p></div>
          <button type="button" disabled={!listing.shop || busy} onClick={() => listing.shop && onShop(listing.shop.id)} className="flex w-full items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted">
            <UserAvatar src={listing.seller.avatarUrl} name={listing.shop?.name ?? listing.seller.displayName} size="md" />
            <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{listing.shop?.name ?? listing.seller.displayName}</span><span className="block text-xs text-muted-foreground">{listing.shop ? `${shopTypeLabel(listing.shop.type)} · View shop` : 'Seller account required to relist'}</span></span><Store size={20} className="shrink-0 text-primary" />
          </button>
          {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          {!listing.isMine && <div className="space-y-4">
            {/* <button type="button" disabled={busy} onClick={() => onMessage(listing.seller.username)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary p-3 font-semibold text-primary"><MessageCircle size={18} /> Chat with seller</button> */}
           <button
  type="button"
  disabled={busy}
  onClick={() =>
    onMessage(
      listing.seller.username,
      `Hi, I'm interested in "${listing.title}". I see the listed price is ${money(listing.price)}. Is it still available?`,
    )
  }
  className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary p-3 font-semibold text-primary"
>
  <MessageCircle size={18} />
  Chat with seller
</button>
            {available && <form onSubmit={(event) => { event.preventDefault(); onBuy({ quantity, fulfillment, note }); }}>
              <fieldset disabled={busy} className="space-y-4">
                <label className="block text-sm font-semibold">Quantity<input type="number" required min={1} max={listing.stockQuantity} step={1} value={Number.isNaN(quantity) ? '' : quantity} onChange={(event) => setQuantity(event.target.valueAsNumber)} className="glass-input mt-2 w-full rounded-lg p-3 font-normal" /></label>
                <label className="block text-sm font-semibold">How would you like to receive your order?
                  <select value={fulfillment} onChange={(event) => setFulfillment(event.target.value as MarketplaceFulfillment)} className="glass-input mt-2 w-full rounded-lg p-3 font-normal"><option value="PICKUP">Pickup from seller</option><option value="PAY_ON_DELIVERY">Pay on delivery</option></select>
                </label>
                <label className="block text-sm font-semibold">Note to seller (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} className="glass-input mt-2 w-full resize-none rounded-lg p-3 font-normal" placeholder="Delivery area, pickup time, or a question" /></label>
                <p className="flex justify-between text-sm"><span>Item total</span><strong>{money(Number(listing.price) * (Number.isFinite(quantity) ? quantity : 0))}</strong></p>
                <button type="submit" disabled={busy} className="brand-gradient flex w-full items-center justify-center gap-2 rounded-lg p-3 font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={18} className="animate-spin" /> : <ShoppingBag size={18} />} Place order</button>
                <p className="text-xs leading-5 text-muted-foreground">No payment is taken here. Confirm availability, any delivery charge, and payment or pickup details with the seller in Messenger.</p>
              </fieldset>
            </form>}
          </div>}
          {listing.isMine && <div className="space-y-3">
            <h2 className="font-bold">Manage listing</h2>
            <form onSubmit={(event) => { event.preventDefault(); onStock(stock); }} className="space-y-2">
              <label className="block text-sm font-semibold">Available stock (excluding reserved orders)<input type="number" min={0} max={1000000} step={1} required disabled={busy} value={Number.isNaN(stock) ? '' : stock} onChange={(event) => setStock(event.target.valueAsNumber)} className="glass-input mt-2 w-full rounded-lg p-3 font-normal" /></label>
              <button type="submit" disabled={busy} className="w-full rounded-lg border border-primary p-3 text-sm font-semibold text-primary disabled:opacity-60">Update stock</button>
            </form>
            {listing.status === 'CANCELED' ? <button type="button" disabled={busy} onClick={() => onStatus('ACTIVE')} className="w-full rounded-lg border border-border p-3 text-sm font-semibold">Relist item</button> : <div className="flex gap-2">
              <button type="button" disabled={busy || listing.status === 'SOLD'} onClick={() => onStatus('SOLD')} className="flex-1 rounded-lg bg-foreground p-3 text-sm font-semibold text-background disabled:opacity-50">Mark sold</button>
              <button type="button" disabled={busy} onClick={() => onStatus('CANCELED')} className="flex-1 rounded-lg border border-border p-3 text-sm font-semibold">Remove listing</button>
            </div>}
          </div>}
          {listing.shop && <div className="border-t border-border pt-5">
            <div className="flex items-center justify-between gap-2"><h2 className="font-bold">More from this shop</h2><button type="button" disabled={busy} onClick={() => onShop(listing.shop!.id)} className="shrink-0 text-xs font-semibold text-primary">View all</button></div>
            {relatedLoading ? <p className="mt-3 text-sm text-muted-foreground">Loading available items…</p> : relatedError ? <p role="alert" className="mt-3 text-sm text-muted-foreground">{relatedError}</p> : related.length ? <div className="mt-3 grid grid-cols-2 gap-3">{related.map((item) => <ProductCard key={item.id} listing={item} onOpen={() => { if (!busy) onSelect(item); }} />)}</div> : <p className="mt-3 text-sm text-muted-foreground">No other items are currently in stock.</p>}
          </div>}
        </section>
      </div>
    </MallDialog>
  );
}
