'use client';

import { useState } from 'react';
import { mockCreators, mockSignals } from '@/lib/mock';

export default function WatchlistPage() {
  const [watchlistCreators] = useState<Set<string>>(new Set());
  const [watchlistSignals] = useState<Set<string>>(new Set());

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Watchlist</h1>
        <p className="text-muted-foreground mt-2">
          Keep track of your favorite creators and signals.
        </p>
      </div>

      {/* Creators Section */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Watched Creators ({watchlistCreators.size})</h2>
        {watchlistCreators.size === 0 ? (
          <div className="glass-dashed rounded-2xl p-12 text-center">
            <p className="text-muted-foreground">No creators in your watchlist yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Add creators from the Creators page to track them here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockCreators.map((creator) => (
              <div key={creator.id} className="glass-card rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{creator.avatar}</span>
                  <div>
                    <p className="font-semibold text-foreground">{creator.name}</p>
                    <p className="text-xs text-muted-foreground">{creator.category}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signals Section */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">Watched Signals ({watchlistSignals.size})</h2>
        {watchlistSignals.size === 0 ? (
          <div className="glass-dashed rounded-2xl p-12 text-center">
            <p className="text-muted-foreground">No signals in your watchlist yet.</p>
            <p className="text-sm text-muted-foreground mt-2">Add signals from the Market to track their performance.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockSignals.map((signal) => (
              <div key={signal.id} className="glass-card rounded-2xl p-4">
                <p className="text-2xl mb-2">{signal.badge}</p>
                <p className="font-semibold text-foreground">{signal.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
