'use client';

import { Suspense, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Briefcase,
  Clock3,
  Copy,
  History,
  Loader2,
  Minus,
  ReceiptText,
  Send,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  activityApi,
  kycApi,
  walletApi,
  withdrawalsApi,
  type ActivityItem,
  type KycStatus,
  type SupportedKycCountry,
  type SupportedKycDocument,
  type WalletOverview,
  type WalletTransaction,
  type WalletTransactionType,
  type Withdrawal,
  type WithdrawalDestination,
} from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import {
  nairaToSignalFaceCoins,
  signalFaceCoinsToNaira,
} from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import { naira } from '@/components/dashboard/SignalMarketCard';

const PAGE_SIZE = 20;

const transactionLabel: Record<WalletTransactionType, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  WITHDRAWAL_HOLD: 'Withdrawal hold',
  WITHDRAWAL_COMPLETED: 'Withdrawal completed',
  WITHDRAWAL_RELEASE: 'Withdrawal released',
  WITHDRAWAL_REVERSAL: 'Withdrawal reversed',
  TRADE_BUY: 'Signal purchase',
  TRADE_SELL: 'Signal sale',
  TRANSFER_SENT: 'SC sent',
  TRANSFER_RECEIVED: 'SC received',
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
  FAILED: 'KYC failed',
  EXPIRED: 'KYC expired',
};

const transferModeLabel = {
  deposit: 'Deposit',
  withdraw: 'Withdraw',
  send: 'Send',
  receive: 'Receive',
} as const;

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
  valueClassName = 'text-2xl lg:text-3xl',
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: typeof Briefcase;
  tone?: 'up' | 'down' | 'neutral';
  valueClassName?: string;
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
        className={`mt-4 ${valueClassName} font-bold ${
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-foreground'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
    </div>
  );
}

function SignalFaceCoinsValue({
  amount,
  unitClassName = 'text-[0.5em]',
}: {
  amount: number;
  unitClassName?: string;
}) {
  return (
    <>
      {amount.toLocaleString(undefined, {
        minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
        maximumFractionDigits: 4,
      })}{' '}
      <span className={unitClassName}>SC</span>
    </>
  );
}

function PortfolioPageInner() {
  const { user, isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verifiedFlutterwaveRef = useRef<string | null>(null);
  const handledSmileReturnRef = useRef<string | null>(null);
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [transactionCursor, setTransactionCursor] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [kycStatus, setKycStatus] = useState<KycStatus>('NOT_STARTED');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mode, setMode] = useState<'deposit' | 'withdraw' | 'send' | 'receive'>('deposit');
  const [portfolioTab, setPortfolioTab] = useState<'holdings' | 'balance'>('holdings');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [recipient, setRecipient] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [startingKyc, setStartingKyc] = useState(false);
  const [kycCountries, setKycCountries] = useState<SupportedKycCountry[]>([]);
  const [kycDocuments, setKycDocuments] = useState<SupportedKycDocument[]>([]);
  const [country, setCountry] = useState('NG');
  const [providerDocumentType, setProviderDocumentType] = useState('');
  const [destinations, setDestinations] = useState<WithdrawalDestination[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [destinationId, setDestinationId] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('NG');
  const [destinationCurrency, setDestinationCurrency] = useState('NGN');
  const [accountBank, setAccountBank] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [beneficiaryName, setBeneficiaryName] = useState('');

  const loadPortfolio = async () => {
    const [
      walletResult,
      transactionsResult,
      activityResult,
      kycResult,
      countriesResult,
      destinationsResult,
      withdrawalsResult,
    ] = await Promise.allSettled([
      walletApi.getMe(),
      walletApi.transactions(null, PAGE_SIZE),
      activityApi.list(null, 8),
      walletApi.kyc(),
      kycApi.countries(),
      withdrawalsApi.destinations(),
      withdrawalsApi.list(),
    ]);

    if (walletResult.status === 'fulfilled') setWallet(walletResult.value);
    if (transactionsResult.status === 'fulfilled') {
      setTransactions(transactionsResult.value.items);
      setTransactionCursor(transactionsResult.value.nextCursor);
    }
    if (activityResult.status === 'fulfilled') setActivity(activityResult.value.items);
    if (kycResult.status === 'fulfilled') setKycStatus(kycResult.value.kycStatus);
    if (countriesResult.status === 'fulfilled') setKycCountries(countriesResult.value);
    if (destinationsResult.status === 'fulfilled') {
      setDestinations(destinationsResult.value.items);
      setDestinationId((current) => current || destinationsResult.value.items[0]?.id || '');
    }
    if (withdrawalsResult.status === 'fulfilled') setWithdrawals(withdrawalsResult.value.items);

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

  useEffect(() => {
    if (!isAuthenticated || searchParams.get('kyc') !== 'smile-id') return;

    const smileStatus = searchParams.get('status') ?? 'returned';
    const returnKey = `${smileStatus}:${searchParams.get('user_id') ?? ''}`;
    if (handledSmileReturnRef.current === returnKey) return;
    handledSmileReturnRef.current = returnKey;

    kycApi
      .me()
      .then((result) => {
        setKycStatus(result.kycStatus);
        if (result.kycStatus === 'VERIFIED') {
          addToast({
            message: 'Identity verification passed. You can now withdraw.',
            type: 'success',
            duration: 5000,
          });
        } else if (result.kycStatus === 'FAILED' || smileStatus === 'fail') {
          addToast({
            message: "We couldn't verify your identity. Withdrawals are still locked.",
            type: 'error',
            duration: 6000,
          });
        } else if (result.kycStatus === 'CANCELED' || smileStatus === 'cancelled') {
          addToast({
            message: 'Identity verification was cancelled. Complete KYC to withdraw.',
            type: 'info',
            duration: 5000,
          });
        } else {
          addToast({
            message: 'Identity verification is being reviewed. Withdrawals unlock after approval.',
            type: 'info',
            duration: 5000,
          });
        }
        return loadPortfolio();
      })
      .catch((err) => {
        addToast({
          message: err instanceof Error ? err.message : 'Could not refresh KYC status.',
          type: 'error',
          duration: 5000,
        });
      })
      .finally(() => {
        router.replace('/app/portfolio', { scroll: false });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addToast, isAuthenticated, router, searchParams]);

  useEffect(() => {
    if (!isAuthenticated || !country) return;
    let cancelled = false;
    kycApi
      .documents(country)
      .then((items) => {
        if (cancelled) return;
        setKycDocuments(items);
        setProviderDocumentType((current) =>
          items.some((item) => item.providerDocumentType === current)
            ? current
            : items[0]?.providerDocumentType || '',
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setKycDocuments([]);
        setProviderDocumentType('');
        addToast({
          message: err instanceof Error ? err.message : 'Could not load Smile ID document options.',
          type: 'error',
          duration: 4000,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [addToast, country, isAuthenticated]);

  const holdings = wallet?.holdings ?? [];
  const change = wallet?.change24h ?? 0;
  const totalShares = useMemo(
    () => holdings.reduce((sum, h) => sum + Number(h.quantity), 0),
    [holdings],
  );
  const availableNaira = Number(wallet?.pointsBalance ?? 0);
  const availableCoins = nairaToSignalFaceCoins(availableNaira);
  const ownedSignalValue = Number(wallet?.totalValue ?? 0);
  const portfolioBalance = ownedSignalValue + availableNaira;
  const rising = change > 0;
  const falling = change < 0;
  const ChangeIcon = rising ? TrendingUp : falling ? TrendingDown : Minus;
  const walletHandle = user?.username ? `@${user.username}` : '';

  const handleTransfer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      addToast({ message: 'Enter an amount greater than zero.', type: 'error' });
      return;
    }

    const ledgerAmount = parsed;

    setSubmitting(true);
    try {
      if (mode === 'deposit') {
        const checkout = await walletApi.deposit({ amount: ledgerAmount, note });
        if (checkout.url) {
          window.location.assign(checkout.url);
          return;
        }
        throw new Error('Flutterwave did not return a payment link.');
      } else if (mode === 'send') {
        if (!recipient.trim()) {
          addToast({
            message: 'Enter the recipient username.',
            type: 'error',
            duration: 4000,
          });
          return;
        }
        await walletApi.send({ recipient: recipient.trim(), amount: parsed, note });
      } else {
        let selectedDestinationId = destinationId;
        if (!selectedDestinationId) {
          if (!accountBank.trim() || !accountNumber.trim() || !beneficiaryName.trim()) {
            addToast({
              message: 'Enter destination details or select a saved destination.',
              type: 'error',
              duration: 4000,
            });
            return;
          }
          const destination = await withdrawalsApi.createDestination({
            type: 'BANK_ACCOUNT',
            countryCode: destinationCountry.trim().toUpperCase(),
            currency: destinationCurrency.trim().toUpperCase(),
            accountName: beneficiaryName.trim(),
            accountNumber: accountNumber.trim(),
            bankCode: accountBank.trim(),
            bankName: accountBank.trim(),
            isDefault: true,
          });
          selectedDestinationId = destination.id;
          setDestinationId(destination.id);
        }
        await withdrawalsApi.create({
          amount: ledgerAmount,
          note,
          destinationId: selectedDestinationId,
          idempotencyKey: crypto.randomUUID(),
        });
      }
      setAmount('');
      setNote('');
      setRecipient('');
      await loadPortfolio();
      addToast({
        message: mode === 'send' ? 'SC sent.' : 'Withdrawal recorded.',
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

  const copyWalletHandle = async () => {
    if (!walletHandle) return;
    try {
      await navigator.clipboard.writeText(walletHandle);
      addToast({ message: 'Wallet handle copied.', type: 'success', duration: 2500 });
    } catch {
      addToast({ message: 'Could not copy wallet handle.', type: 'error', duration: 3000 });
    }
  };

  const beginKyc = async () => {
    if (country.trim().length !== 2 || !providerDocumentType) {
      addToast({
        message: 'Select your country and identity document.',
        type: 'error',
        duration: 4000,
      });
      return;
    }

    setStartingKyc(true);
    try {
      const review = await kycApi.start({
        countryCode: country.trim().toUpperCase(),
        documentCountry: country.trim().toUpperCase(),
        providerDocumentType,
      });
      setKycStatus(review.kycStatus);
      window.location.assign(review.verificationUrl);
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
              value={<SignalFaceCoinsValue amount={availableCoins} />}
              sub={`${naira(availableNaira)} equivalent`}
              icon={Wallet}
              valueClassName="text-2xl lg:text-[1.45rem] leading-tight"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_0.85fr] gap-4 lg:gap-5">
            <section id="deposit" className="glass-card rounded-2xl p-5 lg:p-6 scroll-mt-6">
              <div
                className="relative grid grid-cols-2 mb-5 overflow-hidden border-b border-white/10 bg-white/[0.03] shadow-lg shadow-black/20"
                role="tablist"
                aria-label="Portfolio view"
              >
                <span
                  aria-hidden
                  className={`absolute inset-y-0 left-0 w-1/2 bg-primary/10 transition-transform duration-300 ease-out ${
                    portfolioTab === 'balance' ? 'translate-x-full' : 'translate-x-0'
                  }`}
                />
                <span
                  aria-hidden
                  className={`absolute bottom-0 left-0 h-0.5 w-1/2 bg-primary transition-transform duration-300 ease-out ${
                    portfolioTab === 'balance' ? 'translate-x-full' : 'translate-x-0'
                  }`}
                />
                {(['holdings', 'balance'] as const).map((nextTab) => (
                  <button
                    key={nextTab}
                    type="button"
                    role="tab"
                    aria-selected={portfolioTab === nextTab}
                    aria-controls="portfolio-view-panel"
                    onClick={() => setPortfolioTab(nextTab)}
                    className={`relative z-10 flex items-center justify-center px-3 py-4 text-sm font-semibold uppercase tracking-wide transition-colors ${
                      portfolioTab === nextTab
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {nextTab === 'holdings' ? 'Holdings' : 'Balance'}
                  </button>
                ))}
              </div>

              <div id="portfolio-view-panel" role="tabpanel">
                {portfolioTab === 'balance' ? (
                  <div className="space-y-4">
                    <div className="py-3">
                      <p className="text-sm text-muted-foreground">Portfolio Balance</p>
                      <p className="mt-2 text-3xl lg:text-4xl font-bold text-foreground">
                        {naira(portfolioBalance)}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Owned Signal value plus your available Signal Credit balance.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="glass-tile rounded-xl p-4">
                        <p className="text-xs text-muted-foreground">Owned Signal Value</p>
                        <p className="mt-2 text-xl font-bold text-foreground">
                          {naira(ownedSignalValue)}
                        </p>
                        <p
                          className={`mt-1 text-xs ${
                            rising ? 'text-up' : falling ? 'text-down' : 'text-muted-foreground'
                          }`}
                        >
                          {rising ? '+' : ''}
                          {change.toFixed(2)}% in 24h
                        </p>
                      </div>

                      <div className="glass-tile rounded-xl p-4">
                        <p className="text-xs text-muted-foreground">Signal Credit</p>
                        <p className="mt-2 text-lg lg:text-xl font-bold text-foreground">
                          <SignalFaceCoinsValue
                            amount={availableCoins}
                            unitClassName="text-[0.58em]"
                          />
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {naira(availableNaira)} equivalent
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 text-xs text-muted-foreground leading-relaxed">
                      Portfolio Balance can move as creator Signals rise or fall. Signal Credit
                      only change when you deposit, withdraw, send, receive, or trade.
                    </div>
                  </div>
                ) : holdings.length === 0 ? (
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
              </div>
            </section>

            <section className="glass-card rounded-2xl p-5 lg:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Wallet size={18} className="text-primary" />
                <h2 className="text-lg font-bold text-foreground">Send & Receive</h2>
              </div>

              <div
                className="relative grid grid-cols-4 mb-5 overflow-hidden border-b border-white/10 bg-white/[0.03] shadow-lg shadow-black/20"
                role="tablist"
                aria-label="Wallet transfer type"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-1/4 bg-primary/10 transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(${
                      mode === 'withdraw' ? 100 : mode === 'send' ? 200 : mode === 'receive' ? 300 : 0
                    }%)`,
                  }}
                />
                <span
                  aria-hidden
                  className="absolute bottom-0 left-0 h-0.5 w-1/4 bg-primary transition-transform duration-300 ease-out"
                  style={{
                    transform: `translateX(${
                      mode === 'withdraw' ? 100 : mode === 'send' ? 200 : mode === 'receive' ? 300 : 0
                    }%)`,
                  }}
                />
                {(['deposit', 'withdraw', 'send', 'receive'] as const).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    role="tab"
                    aria-selected={mode === nextMode}
                    aria-controls="wallet-transfer-panel"
                    onClick={() => setMode(nextMode)}
                    className={`relative z-10 flex items-center justify-center px-3 py-4 text-sm font-semibold uppercase tracking-wide transition-colors ${
                      mode === nextMode
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {transferModeLabel[nextMode]}
                  </button>
                ))}
              </div>

              {mode === 'withdraw' && (
                <div className="space-y-4 mb-4">
                  <div className="rounded-xl glass-tile p-3 flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <ShieldCheck
                          size={15}
                          className={kycStatus === 'VERIFIED' ? 'text-up' : 'text-muted-foreground'}
                        />
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={country}
                        onChange={(event) => {
                          setCountry(event.target.value);
                          setProviderDocumentType('');
                        }}
                        className="pl-3 pr-6 py-2.5 rounded-xl glass-input text-sm text-foreground"
                      >
                        {kycCountries.length === 0 ? (
                          <option value={country}>{country}</option>
                        ) : (
                          kycCountries.map((item) => (
                            <option key={item.countryCode} value={item.countryCode}>
                              {item.countryName}
                            </option>
                          ))
                        )}
                      </select>
                      <select
                        value={providerDocumentType}
                        onChange={(event) => setProviderDocumentType(event.target.value)}
                        className="pl-3 pr-6 py-2.5 rounded-xl glass-input text-sm text-foreground"
                      >
                        <option value="">Identity document</option>
                        {kycDocuments.map((document) => (
                          <option key={document.id} value={document.providerDocumentType}>
                            {document.displayName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {mode === 'receive' ? (
                <div id="wallet-transfer-panel" role="tabpanel" className="space-y-4">
                  <div className="glass-tile rounded-xl p-4">
                    <p className="text-xs text-muted-foreground">Your wallet handle</p>
                    <p className="mt-2 text-2xl font-bold text-foreground">{walletHandle || '@username'}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Share this handle so another user can send SC to your wallet.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyWalletHandle}
                    disabled={!walletHandle}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-3
                      text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-70"
                  >
                    <Copy size={16} />
                    Copy Wallet Handle
                  </button>
                </div>
              ) : (
                <form
                  id="wallet-transfer-panel"
                  role="tabpanel"
                  onSubmit={handleTransfer}
                  className="space-y-3"
                >
                  {mode === 'send' && (
                    <input
                      value={recipient}
                      onChange={(event) => setRecipient(event.target.value)}
                      placeholder="Recipient username"
                      className="w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                    />
                  )}
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder={mode === 'send' ? 'Amount in SC' : 'Amount in ₦'}
                    aria-label={mode === 'send' ? 'Amount in Signal Credit' : 'Amount in naira'}
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                  />
                  {mode === 'send' && (
                    <p className="text-xs text-muted-foreground">
                      {amount || '0'} SC ={' '}
                      {naira(signalFaceCoinsToNaira(amount || 0))}
                    </p>
                  )}
                  <input
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Note optional"
                    className="w-full px-4 py-3 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                  />
                  {mode === 'withdraw' && (
                    <div className="space-y-2">
                      {destinations.length > 0 && (
                        <select
                          value={destinationId}
                          onChange={(event) => setDestinationId(event.target.value)}
                          className="w-full pl-3 pr-6 py-2.5 rounded-xl glass-input text-sm text-foreground"
                        >
                          {destinations.map((destination) => (
                            <option key={destination.id} value={destination.id}>
                              {destination.accountName ?? destination.type} - {destination.currency}{' '}
                              {destination.accountNumberLast4 ? `****${destination.accountNumberLast4}` : ''}
                            </option>
                          ))}
                          <option value="">Add new destination</option>
                        </select>
                      )}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        value={destinationCountry}
                        onChange={(event) => setDestinationCountry(event.target.value.slice(0, 2).toUpperCase())}
                        placeholder="Country"
                        className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                      />
                      <input
                        value={destinationCurrency}
                        onChange={(event) => setDestinationCurrency(event.target.value.slice(0, 3).toUpperCase())}
                        placeholder="Currency"
                        className="px-3 py-2.5 rounded-xl glass-input text-sm text-foreground placeholder-muted-foreground"
                      />
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
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={submitting || (mode === 'withdraw' && kycStatus !== 'VERIFIED')}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl brand-gradient px-4 py-3
                      text-sm font-semibold text-white hover:brightness-110 transition disabled:opacity-70"
                  >
                    {submitting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : mode === 'send' ? (
                      <Send size={16} />
                    ) : (
                      <Wallet size={16} />
                    )}
                    {submitting
                      ? 'Processing...'
                      : mode === 'deposit'
                        ? 'Continue to Flutterwave'
                        : mode === 'send'
                          ? 'Send SC'
                          : kycStatus === 'VERIFIED'
                            ? 'Request Withdrawal'
                            : 'Verify KYC to Withdraw'}
                  </button>
                </form>
              )}
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

export default function PortfolioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 size={22} className="animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PortfolioPageInner />
    </Suspense>
  );
}
