'use client';

import { usePortfolio } from '@/lib/stores';
import { PriceChart } from '@/components/dashboard/PriceChart';
import { generatePriceHistory } from '@/lib/mock';
import { TrendingUp, TrendingDown, X } from 'lucide-react';

export default function PortfolioPage() {
  const portfolio = usePortfolio();
  const priceHistory = generatePriceHistory(portfolio.totalValue / 10, 30);
  const isPositive = portfolio.change24h >= 0;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Your Portfolio</h1>
        <p className="text-muted-foreground mt-2">
          Track and manage your signal holdings and investments.
        </p>
      </div>

      {/* Portfolio Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Total Portfolio Value</p>
          <p className="text-3xl font-bold text-foreground">${portfolio.totalValue.toFixed(2)}</p>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-muted-foreground mb-2">24h Change</p>
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp size={24} className="text-up" />
            ) : (
              <TrendingDown size={24} className="text-destructive" />
            )}
            <p className={`text-3xl font-bold ${isPositive ? 'text-up' : 'text-down'}`}>
              {isPositive ? '+' : ''}{portfolio.change24h}%
            </p>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-muted-foreground mb-2">Holdings</p>
          <p className="text-3xl font-bold text-foreground">{portfolio.signals.length}</p>
          <p className="text-xs text-muted-foreground mt-2">signals owned</p>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Portfolio Value Over Time</h2>
        <PriceChart data={priceHistory} height={300} />
      </div>

      {/* Holdings */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-bold text-foreground mb-4">Your Holdings</h2>
        {portfolio.signals.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No signals in your portfolio yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Start investing to see your holdings here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {portfolio.signals.map((signal) => (
              <div key={signal.id} className="flex items-center justify-between p-4 glass-tile rounded-xl">
                <div>
                  <p className="font-semibold text-foreground">{signal.signalName}</p>
                  <p className="text-sm text-muted-foreground">by {signal.creatorName}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">${signal.totalValue.toFixed(2)}</p>
                  <p className={signal.change24h >= 0 ? 'text-up' : 'text-down'}>
                    {signal.change24h >= 0 ? '+' : ''}{signal.change24h}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
