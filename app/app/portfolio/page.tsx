'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Minus, Loader2, Briefcase, Wallet } from 'lucide-react';
import { walletApi, type WalletOverview } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { UserAvatar } from '@/components/UserAvatar';
import { money } from '@/components/dashboard/SignalMarketCard';

export default function PortfolioPage() {
  const { isAuthenticated, setAuthModalOpen } = useAuth();
  const { addToast } = useToast();
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    walletApi
      .getMe()
      .then((w) => {
        if (!cancelled) setWallet(w);
      })
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
  }, [isAuthenticated, addToast]);

  const change = wallet?.change24h ?? 0;
  const rising = change > 0;
  const falling = change < 0;
  const Trend = rising ? TrendingUp : falling ? TrendingDown : Minus;
  const holdings = wallet?.holdings ?? [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 lg:space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Your Portfolio</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Track and manage your signal holdings and investments.
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="glass-card rounded-2xl p-8 sm:p-10 text-center">
          <Briefcase size={28} className="mx-auto text-muted-foreground" />
          <p className="mt-3 font-semibold text-card-foreground">Sign in to see your portfolio</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your holdings and balance live on your account.
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
            <div className="glass-card rounded-2xl p-5 lg:p-6">
              <p className="text-sm text-muted-foreground mb-2">Total Portfolio Value</p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">
                {money(wallet?.totalValue ?? 0)}
              </p>
            </div>

            <div className="glass-card rounded-2xl p-5 lg:p-6">
              <p className="text-sm text-muted-foreground mb-2">24h Change</p>
              <div className="flex items-center gap-2">
                <Trend
                  size={22}
                  className={
                    rising ? 'text-up' : falling ? 'text-destructive' : 'text-muted-foreground'
                  }
                />
                <p
                  className={`text-2xl lg:text-3xl font-bold ${
                    rising ? 'text-up' : falling ? 'text-down' : 'text-muted-foreground'
                  }`}
                >
                  {rising ? '+' : ''}
                  {change.toFixed(2)}%
                </p>
              </div>
            </div>

            <div className="glass-card rounded-2xl p-5 lg:p-6">
              <p className="text-sm text-muted-foreground mb-2">Holdings</p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">{holdings.length}</p>
              <p className="text-xs text-muted-foreground mt-2">signals owned</p>
            </div>

            <div className="glass-card rounded-2xl p-5 lg:p-6">
              <p className="text-sm text-muted-foreground mb-2 inline-flex items-center gap-1.5">
                <Wallet size={14} /> SignalBalance
              </p>
              <p className="text-2xl lg:text-3xl font-bold text-foreground">
                <span className="text-primary text-lg">SF</span>{' '}
                {Number(wallet?.pointsBalance ?? 0).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="text-xs text-muted-foreground mt-2">available to trade</p>
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 lg:p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Your Holdings</h2>

            {holdings.length === 0 ? (
              <div className="text-center py-12">
                <Briefcase size={26} className="mx-auto text-muted-foreground" />
                <p className="mt-3 text-muted-foreground">No signals in your portfolio yet.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start investing to see your holdings here.
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
                  // Unrealised P/L against what they actually paid.
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
                          @ {money(h.avgBuyPrice)} avg
                        </p>
                      </Link>

                      <div className="text-right flex-shrink-0">
                        <p className="font-semibold text-foreground">{money(h.currentValue)}</p>
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
        </>
      )}
    </div>
  );
}
