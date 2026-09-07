'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  Clock3,
  History,
  Loader2,
  Minus,
  ReceiptText,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  activityApi,
  walletApi,
  type ActivityItem,
  type KycStatus,
  type WalletOverview,
  type WalletTransaction,
  type WalletTransactionType,
} from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';
import { naira } from '@/components/dashboard/SignalMarketCard';

const PAGE_SIZE = 20;
type KycIdType = 'passport' | 'national_id' | 'drivers_license' | 'voter_id';

const transactionLabel: Record<WalletTransactionType, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  TRADE_BUY: 'Signal purchase',
  TRADE_SELL: 'Signal sale',
  SIGNUP_BONUS: 'Signup reward',
  REFERRAL_BONUS: 'Referral reward',
  ADMIN_ADJUST: 'Wallet adjustment',
  REWARD_CLAIM: 'Reward claimed',
};

const kycLabel: Record<KycStatus, string> = {
  NOT_STARTED: 'KYC not started',
  PROCESSING: 'KYC processing',
  VERIFIED: 'KYC verified',
  REQUIRES_INPUT: 'KYC needs attention',
  CANCELED: 'KYC canceled',
};

function signedNaira(raw: string | number) {
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return '₦0.00';
  const sign = amount > 0 ? '+' : amount < 0 ? '-' : '';
  return `${sign}₦${Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function timeAgo(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return dateTime(value);
}

function PortfolioStat({
  label,
  value,
  sub,
  icon: Icon,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Briefcase;
  tone?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="glass-card rounded-2xl p-5 lg:p-6 min-h-32">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="h-9 w-9 rounded-xl bg-sidebar-accent flex items-center justify-center">
          <Icon
            size={17}
            className={
              tone === 'up'
                ? 'text-up'
                : tone === 'down'
                  ? 'text-destructive'
                  : 'text-muted-foreground'
            }
          />
        </span>
      </div>
      <p
        className={`mt-4 text-2xl lg:text-3xl font-bold ${
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
}

export default function PortfolioPage() {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedFlutterwaveRef = useRef<string | null>(null);
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [kycStatus, setKycStatus] = useState<KycStatus>('NOT_STARTED');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [startingKyc, setStartingKyc] = useState(false);
  const [legalName, setLegalName] = useState('');
  const [country, setCountry] = useState('US');
  const [idType, setIdType] = useState<KycIdType>('passport');
  const [idLast4, setIdLast4] = useState('');
  const [accountBank, setAccountBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');

  const loadPortfolio = async () => {
    const [walletResult, transactionsResult, activityResult, kycResult] = await Promise.allSettled([
      walletApi.getMe(),
      walletApi.transactions(null, PAGE_SIZE),
      activityApi.list(null, 8),
      walletApi.kyc(),
    ]);

    if (walletResult.status === 'fulfilled') setWallet(walletResult.value);
    if (transactionsResult.status === 'fulfilled') {
      setTransactions(transactionsResult.value.items);
      setTransactionCursor(transactionsResult.value.nextCursor);
    }
    if (activityResult.status === 'fulfilled') setActivity(activityResult.value.items);
    if (kycResult.status === 'fulfilled') setKycStatus(kycResult.value.kycStatus);

    if (walletResult.status === 'rejected') {
      throw walletResult.reason;
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    loadPortfolio()
      .catch((err) => {
        if (cancelled) return;
        addToast({
          message: err instanceof Error ? err.message : 'Could not load your portfolio.',
          type: 'error',
          duration: 4000,
        });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const transactionId = searchParams.get('transaction_id');
    const txRef = searchParams.get('tx_ref');
    const cameFromFlutterwave =
      searchParams.get('deposit') === 'flutterwave' ||
      searchParams.get('buy') === 'flutterwave';

    if (!cameFromFlutterwave || !transactionId) return;

    const verificationKey = `${transactionId}:${txRef ?? ''}`;
    if (verifiedFlutterwaveRef.current === verificationKey) return;
    verifiedFlutterwaveRef.current = verificationKey;

    walletApi
      .verifyFlutterwave({ transactionId, txRef: txRef ?? undefined })
      .then((result) => {
        if (result.processed) {
          addToast({
            message:
              result.kind === 'signal_buy'
                ? 'Signal purchase confirmed.'
                : 'Wallet funding confirmed.',
            type: 'success',
            duration: 4000,
          });
        } else {
          addToast({
            message: 'Flutterwave payment was not confirmed yet.',
            type: 'info',
            duration: 4000,
          });
        }
        return loadPortfolio();
      })
      .catch((err) => {
        addToast({
          message: err instanceof Error ? err.message : 'Could not verify Flutterwave payment.',
          type: 'error',
          duration: 5000,
        });
      })
      .finally(() => {
        router.replace('/app/portfolio', { scroll: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router, searchParams]);

  const holdings = wallet?.holdings ?? [];
  const change = wallet?.change24h ?? 0;
  const totalShares = useMemo(
    () => holdings.reduce((sum, h) => sum + Number(h.quantity), 0),
    [holdings],
  );
  const available = Number(wallet?.pointsBalance ?? 0);
  const rising = change > 0;
  const falling = change < 0;
  const ChangeIcon = rising ? TrendingUp : falling ? TrendingDown : Minus;

  const handleTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast({ message: 'Enter an amount greater than zero.', type: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'deposit') {
        const checkout = await walletApi.deposit({ amount: parsed, note });
        if (checkout.url) {
          window.location.assign(checkout.url);
          return;
        }
        throw new Error('Flutterwave did not return a payment link.');
      } else {
        if (!accountBank.trim() || !accountNumber.trim() || !beneficiaryName.trim()) {
          addToast({
            message: 'Enter bank code, account number, and beneficiary name.',
            type: 'error',
            duration: 4000,
          });
          return;
        }
        await walletApi.withdraw({
          amount: parsed,
          note,
          accountBank: accountBank.trim(),
          accountNumber: accountNumber.trim(),
          beneficiaryName: beneficiaryName.trim(),
        });
      }
      setAmount('');
      setNote('');
      await loadPortfolio();
      addToast({
        message: 'Withdrawal recorded.',
        type: 'success',
      });
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not update your balance.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const beginKyc = async () => {
    if (!legalName.trim() || country.trim().length !== 2 || idLast4.trim().length !== 4) {
      addToast({
        message: 'Enter legal name, 2-letter country code, and the last 4 ID digits.',
        type: 'error',
        duration: 4000,
      });
      return;
    }

    setStartingKyc(true);
    try {
      const review = await walletApi.requestKyc({
        legalName,
        country: country.trim().toUpperCase(),
        idType,
        idLast4: idLast4.trim(),
      });
      setKycStatus(review.kycStatus);
      addToast({ message: 'KYC submitted for withdrawal review.', type: 'success', duration: 5000 });
      await loadPortfolio();
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not submit KYC verification.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setStartingKyc(false);
    }
  };

  const loadMoreTransactions = async () => {
    if (!transactionCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await walletApi.transactions(transactionCursor, PAGE_SIZE);
      setTransactions((prev) => [...prev, ...page.items]);
      setTransactionCursor(page.nextCursor);
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : 'Could not load more transactions.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Portfolio Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Holdings, wallet balance, transaction history, and activity in one place.
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Briefcase size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">Sign in to see your portfolio</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your holdings, wallet balance, and transaction history live on your account.
          </p>
          <button
            onClick={() => setAuthModalOpen(true)}
            className="mt-5 px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition"
          >
            Sign in
          </button>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <PortfolioStat
              label="Total Portfolio Value"
              value={naira(wallet?.totalValue ?? 0)}
              sub="Current value of owned signals"
              icon={Briefcase}
            />
            <PortfolioStat
              label="24-hour Change"
              value={`${rising ? '+' : ''}${change.toFixed(2)}%`}
              sub="Weighted across current holdings"
              icon={ChangeIcon}
              tone={rising ? 'up' : falling ? 'down' : 'neutral'}
            />
            <PortfolioStat
              label="Holdings"
              value={holdings.length.toLocaleString()}
              sub={`${totalShares.toLocaleString(undefined, { maximumFractionDigits: 4 })} shares owned`}
              icon={ReceiptText}
            />
            <PortfolioStat
              label="Available to Trade"
              value={`₦${available.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
              sub="SignalFace balance"
              icon={Wallet}
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-4 lg:gap-5">
            <section id="deposit" className="glass-card rounded-2xl p-5 lg:p-6 scroll-mt-6">
              <h2 className="text-lg font-bold text-foreground mb-4">Holdings</h2>

              {holdings.length === 0 ? (
                <div className="text-center py-12">
                  <Briefcase size={26} className="mx-auto text-muted-foreground" />
                  <p className="mt-3 text-muted-foreground">No signals in your portfolio yet.</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Start owning signals to see your holdings here.
                  </p>
                  <Link
                    href="/app/market"
                    className="inline-block mt-5 px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition"
                  >
                    Browse the market
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {holdings.map((h) => {
                    const spent = Number(h.avgBuyPrice) * Number(h.quantity);
                    const value = Number(h.currentValue);
                    const pl = spent > 0 ? ((value - spent) / spent) * 100 : 0;

                    return (
                      <div
                        key={h.signalId}
                        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 glass-tile rounded-xl"
                      >
                        <Link href={`/app/u/${h.creatorUsername}`} className="flex-shrink-0">
                          <UserAvatar name={h.creatorName} size="sm" />
                        </Link>

                        <Link href={`/app/u/${h.creatorUsername}`} className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground truncate">{h.creatorName}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {Number(h.quantity).toLocaleString(undefined, {
                              maximumFractionDigits: 4,
                            })}{' '}
                            shares @ {naira(h.avgBuyPrice)} avg
                          </p>
                        </Link>

                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-foreground">{naira(h.currentValue)}</p>
                          <p
                            className={`text-sm ${
                              pl > 0 ? 'text-up' : pl < 0 ? 'text-down' : 'text-muted-foreground'
                            }`}
                          >
                            {pl > 0 ? '+' : ''}
                            {pl.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="glass-card rounded-2xl p-5 lg:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Wallet size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-foreground">Deposit & Withdrawal</h2>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                {(['deposit', 'withdraw'] as const).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    onClick={() => setMode(nextMode)}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                      mode === nextMode
                        ? 'brand-gradient text-white'
                        : 'glass-chip text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {nextMode === 'deposit' ? (
                      <ArrowDownToLine size={15} />
                    ) : (
                      <ArrowUpFromLine size={15} />
                    )}
                    {nextMode === 'deposit' ? 'Deposit' : 'Withdraw'}
                  </button>
                ))}
              </div>

              <div className="mb-4 rounded-xl glass-tile p-3 flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <ShieldCheck size={15} className={kycStatus === 'VERIFIED' ? 'text-up' : 'text-muted-foreground'} />
                    Withdrawal KYC
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {kycLabel[kycStatus]}
                  </span>
                </span>
                {kycStatus !== 'VERIFIED' && (
                  <button
                    type="button"
                    onClick={beginKyc}
                    disabled={startingKyc}
                    className="inline-flex items-center justify-center gap-2 rounded-xl glass-chip px-3 py-2 text-xs font-semibold
                      text-foreground hover:brightness-125 transition disabled:opacity-70 flex-shrink-0"
                  >
                    {startingKyc ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                    Verify
                  </button>
                )}
              </div>

              {kycStatus !== 'VERIFIED' && (
                <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    value={legalName}
                    onChange={(event) => setLegalName(event.target.value)}
                    placeholder="Legal name"
                    className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                  />
                  <input
                    value={country}
                    onChange={(event) => setCountry(event.target.value.slice(0, 2).toUpperCase())}
                    placeholder="Country code"
                    className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                  />
                  <select
                    value={idType}
                    onChange={(event) => setIdType(event.target.value as KycIdType)}
                    className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground"
                  >
                    <option value="passport">Passport</option>
                    <option value="national_id">National ID</option>
                    <option value="drivers_license">Driver license</option>
                    <option value="voter_id">Voter ID</option>
                  </select>
                  <input
                    value={idLast4}
                    onChange={(event) => setIdLast4(event.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="ID last 4"
                    inputMode="numeric"
                    className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                  />
                </div>
              )}

              <form onSubmit={handleTransfer} className="space-y-3">
                <input
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="Amount in SF"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                />
                <input
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Note optional"
                  className="w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                />
                {mode === 'withdraw' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      value={accountBank}
                      onChange={(event) => setAccountBank(event.target.value)}
                      placeholder="Bank code"
                      className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                    />
                    <input
                      value={accountNumber}
                      onChange={(event) => setAccountNumber(event.target.value)}
                      placeholder="Account number"
                      className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                    />
                    <input
                      value={beneficiaryName}
                      onChange={(event) => setBeneficiaryName(event.target.value)}
                      placeholder="Beneficiary name"
                      className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={submitting || (mode === 'withdraw' && kycStatus !== 'VERIFIED')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-3
                    text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-70"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                  {submitting
                    ? 'Processing...'
                    : mode === 'deposit'
                      ? 'Continue to Flutterwave'
                      : kycStatus === 'VERIFIED'
                        ? 'Request Withdrawal'
                        : 'Verify KYC to Withdraw'}
                </button>
              </form>
            </section>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-5">
            <section className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 lg:p-6 flex items-center gap-2">
                <History size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-foreground">Transaction History</h2>
              </div>

              {transactions.length === 0 ? (
                <div className="px-5 pb-8 text-sm text-muted-foreground text-center">
                  No transactions yet.
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {transactions.map((transaction) => {
                    const positive = Number(transaction.amount) >= 0;
                    return (
                      <li key={transaction.id} className="p-4 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {transactionLabel[transaction.type]}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {transaction.note ?? 'No note'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {dateTime(transaction.createdAt)}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-sm font-bold ${positive ? 'text-up' : 'text-down'}`}>
                            {signedNaira(transaction.amount)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Bal. {signedNaira(transaction.balanceAfter).replace(/^[-+]/, '')}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {transactionCursor && (
                <button
                  type="button"
                  onClick={loadMoreTransactions}
                  disabled={loadingMore}
                  className="w-full py-4 text-sm font-semibold text-primary hover:underline disabled:opacity-70"
                >
                  {loadingMore ? 'Loading...' : 'Load more transactions'}
                </button>
              )}
            </section>

            <section className="glass-card rounded-2xl overflow-hidden">
              <div className="p-5 lg:p-6 flex items-center gap-2">
                <Clock3 size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-foreground">Activity Logs</h2>
              </div>

              {activity.length === 0 ? (
                <div className="px-5 pb-8 text-sm text-muted-foreground text-center">
                  No activity logs yet.
                </div>
              ) : (
                <ul className="divide-y divide-white/10">
                  {activity.map((item) => (
                    <li key={item.id} className="p-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.title}</p>
                        {item.body && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {item.body}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{timeAgo(item.createdAt)}</p>
                      </div>
                      {item.amount && (
                        <p
                          className={`text-sm font-bold flex-shrink-0 ${
                            item.tone === 'down' ? 'text-down' : 'text-up'
                          }`}
                        >
                          {item.amount}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
