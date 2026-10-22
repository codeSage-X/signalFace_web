'use client';

import { useState } from 'react';
import { CalendarClock, Undo2 } from 'lucide-react';
import type { MarketplaceOrder } from '@/lib/api';
import { money } from './market-utils';

// Progress, schedule, and payment history for a Pay small small order. Sellers
// record payments they have received; buyers follow their progress.
export function InstallmentPlan({ order, selling, busy, onRecord, onVoid }: {
  order: MarketplaceOrder; selling?: boolean; busy: boolean;
  onRecord: (amount: number, note: string) => Promise<boolean>;
  onVoid: (paymentId: string) => void;
}) {
  const plan = order.installment!;
  const total = Number(order.total);
  const paid = Number(plan.amountPaid);
  const next = plan.schedule.find((item) => !item.paid);
  const dueThroughNext = next ? plan.schedule.slice(0, next.sequence).reduce((sum, item) => sum + Number(item.amount), 0) : 0;
  const nextOutstanding = Math.max(0, Math.round((dueThroughNext - paid) * 100) / 100);
  const overdue = !!next?.dueDate && new Date(next.dueDate).getTime() < Date.now() && order.status === 'ACCEPTED';
  const editable = selling && order.status === 'ACCEPTED';
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  return (
    <section className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold">{money(plan.amountPaid)} paid</span>
        <span className="text-xs text-muted-foreground">{money(plan.balance)} left of {money(total)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Amount paid" aria-valuemin={0} aria-valuemax={total} aria-valuenow={paid}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, (paid / total) * 100)}%` }} />
      </div>
      {next ? (
        <p className={`flex items-center gap-2 text-xs ${overdue ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
          <CalendarClock size={14} className="shrink-0" />
          {order.status === 'PENDING' ? `First payment of ${money(next.amount)} is due once the seller accepts.`
            : `Payment ${next.sequence} of ${plan.count}: ${money(nextOutstanding)}${next.dueDate ? ` ${overdue ? 'was due' : 'due'} ${new Date(next.dueDate).toLocaleDateString()}` : ''}`}
        </p>
      ) : <p className="text-xs font-semibold text-primary">Fully paid{order.status === 'ACCEPTED' ? (selling ? ' — hand over the item and mark the order completed.' : ' — arrange collection with the seller.') : '.'}</p>}
      <details>
        <summary className="cursor-pointer text-xs font-semibold text-primary">Payment schedule</summary>
        <ol className="mt-2 space-y-1 text-xs">
          {plan.schedule.map((item) => (
            <li key={item.sequence} className="flex justify-between gap-2">
              <span className={item.paid ? 'text-muted-foreground line-through' : ''}>{item.sequence}. {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : item.sequence === 1 ? 'On acceptance' : 'After acceptance'}</span>
              <span className="font-semibold">{money(item.amount)}{item.paid ? ' ✓' : ''}</span>
            </li>
          ))}
        </ol>
      </details>
      {plan.payments.length > 0 && <div>
        <p className="text-xs font-semibold">Payments received</p>
        <ul className="mt-1 space-y-1 text-xs">
          {plan.payments.map((payment) => (
            <li key={payment.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-muted-foreground">{new Date(payment.createdAt).toLocaleDateString()}{payment.note ? ` · ${payment.note}` : ''}</span>
              <span className="flex shrink-0 items-center gap-2 font-semibold">{money(payment.amount)}
                {editable && <button type="button" disabled={busy} onClick={() => onVoid(payment.id)} aria-label={`Undo payment of ${money(payment.amount)}`} className="text-muted-foreground hover:text-destructive disabled:opacity-50"><Undo2 size={14} /></button>}
              </span>
            </li>
          ))}
        </ul>
      </div>}
      {editable && next && <form onSubmit={async (event) => {
        event.preventDefault();
        if (await onRecord(Number(amount || nextOutstanding), note.trim())) { setAmount(''); setNote(''); }
      }} className="space-y-2 border-t border-primary/20 pt-3">
        <p className="text-xs font-semibold">Record a payment you received</p>
        <div className="flex gap-2">
          <input type="number" min={0.01} max={Number(plan.balance)} step={0.01} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={String(nextOutstanding)} aria-label="Amount received" disabled={busy} className="glass-input w-28 min-w-0 rounded-lg p-2" />
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} placeholder="Note (e.g. transfer ref)" aria-label="Payment note" disabled={busy} className="glass-input min-w-0 flex-1 rounded-lg p-2" />
        </div>
        <button type="submit" disabled={busy} className="w-full rounded-lg border border-primary p-2 text-sm font-semibold text-primary disabled:opacity-50">Record payment</button>
      </form>}
      {!selling && order.status === 'ACCEPTED' && next && <p className="text-xs text-muted-foreground">Pay the seller as agreed in Messenger. Each payment appears here once the seller records it.</p>}
    </section>
  );
}
