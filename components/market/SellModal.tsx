'use client';

import { useEffect, useState } from 'react';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { marketApi, type MarketplaceListing, type MarketplaceStorefront, type MarketplaceCategory, type MarketplaceCondition } from '@/lib/api';
import { useToast } from '@/lib/stores';
import { MallDialog } from './MallDialog';
import { CATEGORIES, CONDITIONS, shopTypeLabel } from './market-utils';

export function SellModal({ shop, onClose, onCreated }: { shop: MarketplaceStorefront; onClose: () => void; onCreated: (listing: MarketplaceListing) => void }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const next = images.map((file) => URL.createObjectURL(file)); setPreviews(next);
    return () => next.forEach(URL.revokeObjectURL);
  }, [images]);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!images.length) { setError('Add at least one clear product photo.'); return; }
    setBusy(true); setError('');
    try {
      const listing = await marketApi.createProduct({
        title: String(form.get('title') ?? ''), description: String(form.get('description') ?? ''),
        category: form.get('category') as MarketplaceCategory, condition: form.get('condition') as MarketplaceCondition,
        price: Number(form.get('price')), location: String(form.get('location') ?? ''),
        negotiable: form.get('negotiable') === 'on', stockQuantity: Number(form.get('stockQuantity')), images,
      });
      onCreated(listing); addToast({ message: 'Your product is now live.', type: 'success', duration: 3500 });
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not publish the product.'); }
    finally { setBusy(false); }
  };
  return (
    <MallDialog title="Sell an item" onClose={onClose} busy={busy}>
      <div className="mx-auto h-full max-w-2xl overflow-y-auto bg-background sm:rounded-lg sm:border sm:border-border">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-4 py-4 backdrop-blur sm:px-6"><div><h1 className="text-lg font-bold text-foreground">Sell an item</h1><p className="text-xs text-muted-foreground">{shop.name} · {shopTypeLabel(shop.type)}</p></div><button type="button" disabled={busy} onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted" aria-label="Close"><X size={20} /></button></div>
        <form onSubmit={submit}><fieldset disabled={busy} className="space-y-6 p-4 sm:p-6">
          <div><label className="text-sm font-semibold">Photos <span className="text-primary">*</span></label><div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {previews.map((preview, index) => <div key={preview} className="relative aspect-square overflow-hidden rounded-lg border border-border"><img src={preview} alt={`Product photo ${index + 1}`} className="h-full w-full object-cover" /><button type="button" onClick={() => setImages((current) => current.filter((_, i) => i !== index))} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white" aria-label="Remove photo"><X size={13} /></button></div>)}
            {images.length < 6 && <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-primary/60 bg-primary/5 text-primary"><Camera size={22} /><span className="mt-1 text-[11px] font-semibold">Add photos</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => setImages((current) => [...current, ...Array.from(event.target.files ?? [])].slice(0, 6))} /></label>}
          </div><p className="mt-2 text-xs text-muted-foreground">Up to 6 photos. Put the clearest photo first.</p></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold sm:col-span-2">Title<input name="title" required minLength={3} maxLength={100} placeholder="What are you selling?" className="glass-input mt-2 w-full rounded-lg px-3 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Category<select name="category" required defaultValue="" className="glass-input mt-2 w-full rounded-lg px-3 py-3 font-normal"><option value="" disabled>Select category</option>{CATEGORIES.filter((item) => item.value).map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Condition<select name="condition" required defaultValue="USED" className="glass-input mt-2 w-full rounded-lg px-3 py-3 font-normal">{CONDITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="text-sm font-semibold">Price (NGN)<input name="price" required type="number" min="1" max="1000000000" step="0.01" placeholder="e.g. 85000" className="glass-input mt-2 w-full rounded-lg px-3 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Available quantity<input name="stockQuantity" type="number" min="1" max="1000000" step="1" defaultValue="1" required className="glass-input mt-2 w-full rounded-lg px-3 py-3 font-normal" /></label>
            <label className="text-sm font-semibold">Location<input name="location" defaultValue={shop.location} required minLength={2} maxLength={120} placeholder="e.g. Ikeja, Lagos" className="glass-input mt-2 w-full rounded-lg px-3 py-3 font-normal" /></label>
            <label className="text-sm font-semibold sm:col-span-2">Description<textarea name="description" required minLength={10} maxLength={3000} rows={5} placeholder="Describe the item, its age, features, and anything a buyer should know." className="glass-input mt-2 w-full resize-none rounded-lg px-3 py-3 font-normal" /></label>
          </div>
          <label className="flex items-center gap-3 text-sm"><input name="negotiable" type="checkbox" className="h-4 w-4 accent-primary" /><span>Price is negotiable</span></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy} className="brand-gradient flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 font-semibold text-white disabled:opacity-60">{busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Publish listing</button>
        </fieldset></form>
      </div>
    </MallDialog>
  );
}
