'use client';

import { useState } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { SignalCard } from '@/components/dashboard/SignalCard';
import { mockSignals, marketData } from '@/lib/mock';
import { Search, TrendingUp } from 'lucide-react';

export default function MarketPage() {
  const [search, setSearch] = useState('');

  const filteredSignals = mockSignals.filter((signal) =>
    signal.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Marketplace</h1>
        <p className="text-muted-foreground mt-2">
          Explore and discover signals from top creators and communities.
        </p>
      </div>

      {/* Market Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Signals" value={mockSignals.length} icon={TrendingUp} />
        <StatCard label="Market Cap" value={`$${(marketData.totalMarketValue / 1000000).toFixed(1)}M`} />
        <StatCard label="24h Volume" value={`$${(marketData.volume / 1000000).toFixed(1)}M`} />
        <StatCard label="Traders" value={`${(marketData.traders / 1000).toFixed(0)}K`} />
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search signals by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 glass-input rounded-xl text-foreground placeholder-muted-foreground"
        />
      </div>

      {/* Signals Grid */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">
          Available Signals {filteredSignals.length !== mockSignals.length && `(${filteredSignals.length})`}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSignals.map((signal) => (
            <SignalCard key={signal.id} {...signal} />
          ))}
        </div>
      </div>
    </div>
  );
}
