'use client';

import { useMemo, useState } from 'react';
import { Loader2, Wallet, X, Zap } from 'lucide-react';
import { naira } from '@/components/dashboard/SignalMarketCard';
import { signalsApi, type SignalListItem } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { formatSignalFaceCoins, nairaToSignalFaceCoins } from '@/lib/utils';

interface BuySignalModalProps {
  signal: SignalListItem | null;
  onClose: () => void;
  onPurchased?: () => void;
}

export function BuySignalModal({ signal, onClose, onPurchased }: BuySignalModalProps) {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();
  const [quantity, setQuantity] = useState('1');
  const [paymentMethod, setPaymentMethod] = useState<'balance' | 'flutterwave'>('balance');
  const [submitting, setSubmitting] = useState(false);

  const total = useMemo(() => {
    if (!signal) return 0;
    const qty = Number(quantity);
    const price = Number(signal.price);
    return Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;
  }, [quantity, signal]);

  if (!signal) return null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isAuthenticated) {
      onClose();
      setAuthModalOpen(true);
      return;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      addToast({ message: 'Enter a quantity greater than zero.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const result = await signalsApi.buy(signal.id, { quantity: qty, paymentMethod });
      if (paymentMethod === 'flutterwave') {
        if (!result.url) throw new Error('Flutterwave did not return a payment link.');
        window.location.assign(result.url);
        return;
      }

      addToast({
        message: `You bought ${qty.toLocaleString()} ${signal.title ?? `${signal.creatorName} Signal`}.`,
        type: 'success',
        duration: 4000,
      });
      onPurchased?.();
      onClose();
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not buy this Signal.',
        type: 'error',
        duration: 5000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-md glass-card rounded-t-3xl sm:rounded-2xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">Buy Signal</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {signal.title ?? `${signal.creatorName} Signal`} · @{signal.creatorUsername}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full glass-chip flex items-center justify-center hover:brightness-125 transition"
            aria-label="Close buy signal"
          >
            <X size={16} className="text-foreground" />
          </button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="glass-tile rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Price per 1 Signal</p>
              <p className="text-lg font-bold text-primary">{naira(signal.price)}</p>
            </div>
            <div className="glass-tile rounded-xl p-3">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-foreground">{naira(total)}</p>
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">Quantity</span>
            <input
              type="number"
              min="0.0001"
              step="0.0001"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
            />
          </label>

          <p className="text-xs text-muted-foreground">
            {quantity || '0'} x {naira(signal.price)} = {naira(total)}
          </p>
          <p className="text-xs text-muted-foreground">
            Wallet cost: {formatSignalFaceCoins(nairaToSignalFaceCoins(total))}
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('balance')}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                paymentMethod === 'balance'
                  ? 'brand-gradient text-white'
                  : 'glass-chip text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wallet size={15} />
              Wallet
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('flutterwave')}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                paymentMethod === 'flutterwave'
                  ? 'brand-gradient text-white'
                  : 'glass-chip text-muted-foreground hover:text-foreground'
              }`}
            >
              <Zap size={15} />
              Flutterwave
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-3
              text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-70"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
            {submitting
              ? 'Processing...'
              : paymentMethod === 'flutterwave'
                ? 'Pay with Flutterwave'
                : 'Buy with SC'}
          </button>
        </form>
      </div>
    </div>
  );
}
