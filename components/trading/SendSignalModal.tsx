'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import { ApiError, signalsApi, type WalletHolding } from '@/lib/api';
import { useToast } from '@/lib/stores';
import { usd } from '@/components/dashboard/SignalMarketCard';

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function units(value: string | number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

interface SendSignalModalProps {
  holding: WalletHolding | null;
  onClose: () => void;
  onSent?: () => void;
}

/** Sends units of one held signal to another user by username. */
export function SendSignalModal({ holding, onClose, onSent }: SendSignalModalProps) {
  const { addToast } = useToast();
  const [recipient, setRecipient] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  // One key per intended send, reused if the same send is retried, so a
  // double-click or a retry after a dropped response sends only once. A new
  // key is made when the form changes or after a send succeeds.
  const sendKey = useRef(newKey());

  useEffect(() => {
    sendKey.current = newKey();
    setRecipient('');
    setQuantity('');
    setNote('');
  }, [holding?.signalId]);

  if (!holding) return null;

  const available = Number(holding.quantity);
  const changed = <T,>(set: (v: T) => void) => (v: T) => {
    sendKey.current = newKey();
    set(v);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const handle = recipient.trim().replace(/^@+/, '');
    const qty = Number(quantity);
    if (!handle) {
      addToast({ message: 'Enter the username to send to.', type: 'error', duration: 3000 });
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      addToast({ message: 'Enter a quantity greater than zero.', type: 'error', duration: 3000 });
      return;
    }
    if (qty > available) {
      addToast({ message: `You have ${units(available)} available to send.`, type: 'error', duration: 3000 });
      return;
    }

    setSending(true);
    try {
      const res = await signalsApi.send(holding.signalId, {
        recipient: handle,
        quantity: qty,
        idempotencyKey: sendKey.current,
        note: note.trim() || undefined,
      });
      sendKey.current = newKey();
      addToast({
        message: `Sent ${units(res.transfer.quantity)} ${holding.creatorName} Signal to @${res.transfer.recipient.username}.`,
        type: 'success',
        duration: 4000,
      });
      onSent?.();
      onClose();
    } catch (err) {
      addToast({
        message: err instanceof ApiError || err instanceof Error ? err.message : 'Could not send this Signal.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="send-signal-title"
    >
      <div className="w-full max-w-md glass-card rounded-t-3xl sm:rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="send-signal-title" className="text-lg font-bold text-foreground">
              Send Signal
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {holding.creatorName} · @{holding.creatorUsername}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full glass-chip flex items-center justify-center hover:brightness-125 transition"
            aria-label="Close send signal"
          >
            <X size={16} className="text-foreground" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-tile rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Available to send</p>
              <p className="text-lg font-bold text-foreground">{units(available)}</p>
            </div>
            <div className="glass-tile rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Current value</p>
              <p className="text-lg font-bold text-primary">
                {usd(Number(quantity) > 0 ? Number(quantity) * Number(holding.currentPrice) : 0)}
              </p>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Send to</span>
            <input
              value={recipient}
              onChange={(e) => changed(setRecipient)(e.target.value)}
              placeholder="Username, e.g. @friend"
              autoComplete="off"
              autoCapitalize="none"
              className="mt-1 w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
            />
          </label>

          <label className="block">
            <span className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              Quantity
              <button
                type="button"
                onClick={() => changed(setQuantity)(String(available))}
                className="text-primary hover:underline"
              >
                Max
              </button>
            </span>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              max={available}
              value={quantity}
              onChange={(e) => changed(setQuantity)(e.target.value)}
              inputMode="decimal"
              className="mt-1 w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
            />
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Note (optional)</span>
            <input
              value={note}
              onChange={(e) => changed(setNote)(e.target.value.slice(0, 160))}
              className="mt-1 w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            Sending is free and can’t be undone. Units you’ve listed on P2P aren’t available to send
            until you cancel the listing.
          </p>

          <button
            type="submit"
            disabled={sending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-3 text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-70"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Sending…' : 'Send Signal'}
          </button>
        </form>
      </div>
    </div>
  );
}
