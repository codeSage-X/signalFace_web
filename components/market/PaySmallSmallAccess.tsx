'use client';

import { useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { marketApi, type MarketplaceStorefront } from '@/lib/api';
import { PAY_SMALL_SMALL } from './market-utils';

// Every shop sells with Place order; Pay small small is switched on per shop by an admin.
export function PaySmallSmallAccess({ shop, onChange }: { shop: MarketplaceStorefront; onChange: (shop: MarketplaceStorefront) => void }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const access = shop.installmentAccess ?? 'NONE';

  async function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try { onChange(await marketApi.applyForPaySmallSmall(note.trim() || undefined)); setNote(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not send your application. Please try again.'); }
    finally { setBusy(false); }
  }

  if (access === 'APPROVED') return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 p-5">
      <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-primary" />
      <div><h2 className="font-bold">{PAY_SMALL_SMALL} is on for your shop</h2><p className="mt-1 text-sm text-muted-foreground">Offer it on any item when you list it, or from the item&apos;s Manage listing panel.</p></div>
    </div>
  );

  if (access === 'PENDING') return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5">
      <Clock size={22} className="mt-0.5 shrink-0 text-primary" />
      <div><h2 className="font-bold">{PAY_SMALL_SMALL} application under review</h2><p className="mt-1 text-sm text-muted-foreground">Sent{shop.installmentAppliedAt ? ` ${new Date(shop.installmentAppliedAt).toLocaleDateString()}` : ''}. Customers can keep ordering with Place order while an admin reviews your shop.</p></div>
    </div>
  );

  return (
    <form onSubmit={apply} className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <CalendarClock size={22} className="mt-0.5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Offer {PAY_SMALL_SMALL}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Let customers reserve an item and pay for it weekly or monthly. An admin approves each shop before it can offer this.</p>
          {access === 'REJECTED' && <p className="mt-3 rounded-lg bg-muted p-3 text-sm">Your last application was not approved{shop.installmentReviewNote ? `: ${shop.installmentReviewNote}` : '.'} You can apply again.</p>}
        </div>
      </div>
      <fieldset disabled={busy} className="mt-4 space-y-3">
        <label className="block text-sm font-semibold">Why should your shop offer it? (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} className="glass-input mt-2 w-full resize-none rounded-lg p-3 font-normal" placeholder="How long you have traded, what you sell, how you handle payments" /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" className="brand-gradient flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={16} className="animate-spin" />} {access === 'REJECTED' ? 'Apply again' : `Apply for ${PAY_SMALL_SMALL}`}</button>
      </fieldset>
    </form>
  );
}
