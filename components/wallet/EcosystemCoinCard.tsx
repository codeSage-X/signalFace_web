'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Info, Loader2, Send } from 'lucide-react';
import { ApiError, coinsApi, type CoinEarning, type CoinTransactionItem, type CoinValuationNotice } from '@/lib/api';
import { useToast } from '@/lib/stores';

/** Ecosystem Coins, e.g. "12.5 EC". Distinct from Signal Credits (SC), which are real money. */
export function formatEcosystemCoins(value: string | number) {
  const coins = Number(value);
  const safe = Number.isFinite(coins) ? coins : 0;
  return `${safe.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 })} EC`;
}

function signedCoins(value: string) {
  const n = Number(value);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${formatEcosystemCoins(Math.abs(n))}`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** "5 EC per verified referral · 1 EC per post (up to 3 a day)", from the rewards that are on. */
function earningLine(earning: CoinEarning[]) {
  const parts = earning.map((e) => {
    const amount = formatEcosystemCoins(e.amount);
    const cap = e.dailyLimitPerUser ? ` (up to ${e.dailyLimitPerUser} a day)` : '';
    switch (e.trigger) {
      case 'REFERRAL':
        return `${amount} per verified referral`;
      case 'DAILY_LOGIN':
        return `${amount} for signing in each day`;
      case 'POST_CREATED':
        return `${amount} per post${cap}`;
      default:
        return null;
    }
  });
  return parts.filter(Boolean).join(' · ');
}

function newKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The Ecosystem Coin wallet: balance, the no-cash-value notice, sending coins,
 * and the full history with where each coin came from.
 */
export function EcosystemCoinCard() {
  const { addToast } = useToast();
  const [balance, setBalance] = useState<string | null>(null);
  const [valuation, setValuation] = useState<CoinValuationNotice | null>(null);
  const [earning, setEarning] = useState<CoinEarning[]>([]);
  const [items, setItems] = useState<CoinTransactionItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [failed, setFailed] = useState(false);

  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  // One key per intended send, reused if the same send is retried. A new one is
  // made only after a send succeeds or the form changes.
  const sendKey = useRef(newKey());

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [me, page] = await Promise.all([coinsApi.me(), coinsApi.transactions(null)]);
      setBalance(me.balance);
      setValuation(me.valuation);
      setEarning(me.earning ?? []);
      setItems(page.items);
      setCursor(page.nextCursor);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await coinsApi.transactions(cursor);
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      addToast({ message: 'Could not load more coin history.', type: 'error', duration: 3000 });
    } finally {
      setLoadingMore(false);
    }
  };

  const onFormChange = <T,>(set: (v: T) => void) => (v: T) => {
    sendKey.current = newKey();
    set(v);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!recipient.trim()) {
      addToast({ message: 'Enter who to send coins to.', type: 'error', duration: 3000 });
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast({ message: 'Enter an amount greater than zero.', type: 'error', duration: 3000 });
      return;
    }
    setSending(true);
    try {
      const res = await coinsApi.send({
        recipient: recipient.trim(),
        amount: parsed,
        idempotencyKey: sendKey.current,
        note: note.trim() || undefined,
      });
      setBalance(res.balance);
      addToast({ message: `Sent ${formatEcosystemCoins(parsed)} to ${recipient.trim().replace(/^@?/, '@')}`, type: 'success', duration: 4000 });
      sendKey.current = newKey();
      setRecipient('');
      setAmount('');
      setNote('');
      void load();
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not send coins. Please try again.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="ecosystem-coins" aria-labelledby="ecosystem-coins-title" className="glass-card rounded-2xl p-5 lg:p-6 scroll-mt-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins size={18} className="text-primary" />
          <h2 id="ecosystem-coins-title" className="text-lg font-bold text-foreground">
            Ecosystem Coins
          </h2>
        </div>
        {valuation && (
          <span className="self-start text-[11px] font-semibold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300">
            {valuation.withdrawalStatus}
          </span>
        )}
      </div>

      <p className="mt-3 text-3xl font-bold text-foreground">
        {loading ? '—' : failed ? 'Unavailable' : formatEcosystemCoins(balance ?? 0)}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {earningLine(earning) ? `Earn ${earningLine(earning)}. ` : ''}Separate from your SC balance.
      </p>

      {valuation && (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-muted-foreground space-y-2">
          <p className="flex gap-2">
            <Info size={14} className="flex-shrink-0 mt-0.5" />
            <span>{valuation.disclaimer}</span>
          </p>
          {valuation.examplePrices.length > 0 && (
            <div className="pl-6 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span>Possible future listing price, for example:</span>
                {valuation.examplePrices.map((price) => (
                  <span key={price} className="px-2 py-0.5 rounded-full glass-chip text-foreground font-semibold">
                    {price}
                  </span>
                ))}
              </div>
              <p>{valuation.examplePriceNote}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form onSubmit={submit} className="space-y-2.5">
          <p className="text-sm font-semibold text-foreground">Send coins</p>
          <input
            value={recipient}
            onChange={(e) => onFormChange(setRecipient)(e.target.value)}
            placeholder="Username, e.g. @friend"
            autoComplete="off"
            className="w-full px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
          />
          <input
            value={amount}
            onChange={(e) => onFormChange(setAmount)(e.target.value)}
            inputMode="decimal"
            placeholder="Amount (EC)"
            className="w-full px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
          />
          <input
            value={note}
            onChange={(e) => onFormChange(setNote)(e.target.value.slice(0, 160))}
            placeholder="Note (optional)"
            className="w-full px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
          />
          <button
            type="submit"
            disabled={sending || loading || failed}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-3 text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-70"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? 'Sending…' : 'Send coins'}
          </button>
        </form>

        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Coin history</p>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-10 rounded-xl bg-white/[0.06] animate-pulse" />
              ))}
            </div>
          ) : failed ? (
            <button onClick={() => void load()} className="text-sm text-primary hover:underline">
              Couldn’t load your coins. Try again
            </button>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No coins yet. Invite friends to earn your first Ecosystem Coins.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {items.map((t) => (
                <li key={t.id} className="py-2 flex items-center gap-3">
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm text-foreground truncate">{t.label}</span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {shortDate(t.createdAt)}
                      {t.note && t.note !== t.label ? ` · ${t.note}` : ''}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-semibold whitespace-nowrap ${Number(t.amount) >= 0 ? 'text-emerald-300' : 'text-foreground'}`}
                  >
                    {signedCoins(t.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-2 text-sm text-primary hover:underline disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {loadingMore && <Loader2 size={13} className="animate-spin" />}
              Load more
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
