'use client';

import { useState } from 'react';
import { Loader2, Store, X } from 'lucide-react';
import { marketApi, type MarketplaceShopType, type MarketplaceStorefront } from '@/lib/api';
import { MallDialog } from './MallDialog';
import { SHOP_TYPES } from './market-utils';

export function ShopRegistration({ onClose, onCreated }: {
  onClose: () => void; onCreated: (shop: MarketplaceStorefront) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [type, setType] = useState<MarketplaceShopType>('STORE');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const shop = await marketApi.createShop({
        name: String(form.get('name')).trim(), type,
        description: String(form.get('description')).trim(), location: String(form.get('location')).trim(),
      });
      onCreated(shop);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not register your shop. Please try again.'); }
    finally { setBusy(false); }
  }
  return (
    <MallDialog title="Create a Shopping Mall seller account" busy={busy} onClose={onClose}>
      <header className="flex items-start justify-between gap-3 border-b border-border p-5">
        <div><h1 className="text-xl font-bold">Open your shop</h1><p className="mt-1 text-sm text-muted-foreground">Register a seller account in Shopping Mall to start selling.</p></div>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Close registration" className="rounded-full p-2 hover:bg-muted"><X size={20} /></button>
      </header>
      <form onSubmit={submit} className="p-5">
        <fieldset disabled={busy} className="space-y-5">
          <fieldset><legend className="mb-3 text-sm font-semibold">Choose your account type</legend>
            <div className="grid gap-2 sm:grid-cols-3">{SHOP_TYPES.map((item) => (
              <label key={item.value} className={`cursor-pointer rounded-xl border p-3 ${type === item.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <span className="flex items-center justify-between gap-2"><Store size={19} /><input type="radio" name="type" value={item.value} checked={type === item.value} onChange={() => setType(item.value)} className="accent-primary" /></span>
                <span className="mt-2 block font-semibold">{item.label}</span><span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
              </label>
            ))}</div>
          </fieldset>
          <label className="block text-sm font-semibold">Business name<input name="name" required minLength={2} maxLength={80} className="glass-input mt-2 w-full rounded-lg p-3 font-normal" placeholder="Name of your plaza, store, or supermarket" /></label>
          <label className="block text-sm font-semibold">Location<input name="location" required minLength={2} maxLength={120} className="glass-input mt-2 w-full rounded-lg p-3 font-normal" placeholder="e.g. Ikeja, Lagos" /></label>
          <label className="block text-sm font-semibold">About your business<textarea name="description" required minLength={10} maxLength={1000} rows={3} className="glass-input mt-2 w-full rounded-lg p-3 font-normal" placeholder="Tell shoppers what you sell." /></label>
          <p className="text-xs text-muted-foreground">Your shop is linked to your SignalFace account. Customers can browse your stock, place orders, and contact you in Messenger.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={busy} className="brand-gradient flex w-full items-center justify-center gap-2 rounded-lg p-3 font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={18} className="animate-spin" />} Create seller account</button>
        </fieldset>
      </form>
    </MallDialog>
  );
}
