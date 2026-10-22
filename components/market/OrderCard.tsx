'use client';

import { MessageCircle } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';
import type { MarketplaceOrder, MarketplaceOrderStatus } from '@/lib/api';
import { InstallmentPlan } from './InstallmentPlan';
import { PAY_SMALL_SMALL, fulfillmentLabel, money } from './market-utils';

export function OrderCard({ order, selling, busy, onStatus, onMessage, onOpen, onRecordPayment, onVoidPayment }: {
  order: MarketplaceOrder; selling?: boolean; busy: boolean;
  onStatus: (id: string, status: Exclude<MarketplaceOrderStatus, 'PENDING'>) => void;
  onMessage: (username: string) => void; onOpen: () => void;
  onRecordPayment: (id: string, amount: number, note: string) => Promise<boolean>;
  onVoidPayment: (id: string, paymentId: string) => void;
}) {
  const person = selling ? order.buyer : order.listing.seller;
  const unpaid = !!order.installment && Number(order.installment.balance) > 0;
  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <img src={order.listing.imageUrls[0]} alt="" className="h-16 w-16 rounded-lg object-cover" />
        <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{order.listing.title}</span><span className="mt-1 block text-sm text-muted-foreground">{order.quantity} × {money(order.unitPrice)} · {money(order.total)}</span></span>
      </button>
      <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-muted px-2 py-1 font-semibold capitalize">{order.status.toLowerCase()}</span>{order.installment && <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary">{PAY_SMALL_SMALL} · {order.installment.count} {order.installment.frequency === 'WEEKLY' ? 'weekly' : 'monthly'} payments</span>}<span>{fulfillmentLabel(order.fulfillment, order.paymentPlan)}</span><span className="text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span></div>
      <p className="text-sm text-muted-foreground">{selling ? 'Buyer' : 'Seller'}: <span className="font-semibold text-foreground">{person.displayName}</span></p>
      {order.installment && <InstallmentPlan order={order} selling={selling} busy={busy} onRecord={(amount, note) => onRecordPayment(order.id, amount, note)} onVoid={(paymentId) => onVoidPayment(order.id, paymentId)} />}
      {order.note && <p className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">{order.note}</p>}
      <button type="button" onClick={() => onMessage(person.username)} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary p-2.5 text-sm font-semibold text-primary"><MessageCircle size={16} /> Chat with {selling ? 'buyer' : 'seller'}</button>
      <div className="flex flex-wrap gap-2">
        {selling && order.status === 'PENDING' && <button disabled={busy} onClick={() => onStatus(order.id, 'ACCEPTED')} className="brand-gradient flex-1 rounded-lg p-2.5 text-sm font-semibold text-white disabled:opacity-50">Accept order</button>}
        {selling && order.status === 'ACCEPTED' && <Tooltip content="Available once the order is fully paid" disabled={!unpaid} className="flex-1"><button disabled={busy || unpaid} onClick={() => onStatus(order.id, 'COMPLETED')} className="brand-gradient flex-1 rounded-lg p-2.5 text-sm font-semibold text-white disabled:opacity-50">Mark completed</button></Tooltip>}
        {(order.status === 'PENDING' || (selling && order.status === 'ACCEPTED')) && <button disabled={busy} onClick={() => onStatus(order.id, 'CANCELED')} className="flex-1 rounded-lg border border-border p-2.5 text-sm font-semibold disabled:opacity-50">Cancel order</button>}
      </div>
    </article>
  );
}
