'use client';

import { mockSignals } from '@/lib/mock';
import { StatCard } from '@/components/dashboard/StatCard';
import { SignalCard } from '@/components/dashboard/SignalCard';

export default function SignalsPage() {
  const totalValue = mockSignals.reduce((acc, s) => acc + s.potentialValue, 0);
  const avgPrice = mockSignals.reduce((acc, s) => acc + s.price, 0) / mockSignals.length;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Signal Explorer</h1>
        <p className="text-muted-foreground mt-2">
          Browse all available signals and discover new investment opportunities.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Signals" value={mockSignals.length} />
        <StatCard label="Avg Price" value={`$${avgPrice.toFixed(2)}`} />
        <StatCard label="Total Potential Value" value={`$${totalValue.toLocaleString()}`} />
        <StatCard label="Price Range" value={`$${mockSignals[0].price.toFixed(2)} - $${mockSignals[mockSignals.length - 1].price.toFixed(2)}`} />
      </div>

      {/* Signals Grid */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-4">All Available Signals</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockSignals.map((signal) => (
            <SignalCard key={signal.id} {...signal} />
          ))}
        </div>
      </div>
    </div>
  );
}
