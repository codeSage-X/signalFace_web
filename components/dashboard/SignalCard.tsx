'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/lib/stores';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Star,
  Crown,
  Gem,
  Rocket,
  type LucideIcon,
} from 'lucide-react';

const BADGE_ICONS: Record<string, LucideIcon> = {
  users: Users,
  'trending-up': TrendingUp,
  star: Star,
  crown: Crown,
  gem: Gem,
  rocket: Rocket,
};

export const SignalCard = ({
  name,
  price,
  potentialValue,
  badge = 'star',
  category,
  supply,
  growthPct,
  holders,
  comingSoon = false,
}: {
  name: string;
  price: number;
  potentialValue?: number;
  badge?: string;
  category?: string;
  supply?: number;
  growthPct?: number;
  holders?: number;
  comingSoon?: boolean;
}) => {
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  const handleBuy = () => {
    if (comingSoon) {
      addToast({
        message: 'Trading is coming soon — hang tight!',
        type: 'info',
        duration: 3000,
      });
      return;
    }
    requireAuth(() => {
      addToast({
        message: `Successfully bought 1 ${name}!`,
        type: 'success',
        duration: 3000,
      });
    });
  };

  const Icon = BADGE_ICONS[badge] ?? Star;
  const isPositiveGrowth = growthPct !== undefined && growthPct >= 0;

  return (
    <div className="glass-card rounded-2xl p-6 glass-hover group cursor-pointer">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="mb-2 text-primary">
            <Icon size={28} strokeWidth={1.8} />
          </div>
          <h3 className="font-bold text-foreground">{name}</h3>
          {category && <p className="text-sm text-muted-foreground capitalize mt-1">{category}</p>}
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Current Price</p>
          <p className="text-xl font-bold text-primary">${price.toFixed(2)}</p>
          {growthPct !== undefined && (
            <p className={`flex items-center justify-end gap-1 text-xs ${isPositiveGrowth ? 'text-up' : 'text-down'}`}>
              {isPositiveGrowth ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isPositiveGrowth ? '+' : ''}{growthPct.toFixed(2)}%
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4 pb-4 border-b border-border">
        {potentialValue !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Potential Value</span>
            <span className="text-sm font-semibold text-up">${potentialValue}+</span>
          </div>
        )}
        {supply !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Supply</span>
            <span className="text-sm font-semibold text-foreground">
              {(supply / 1_000_000).toFixed(1)}M
            </span>
          </div>
        )}
        {holders !== undefined && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Holders</span>
            <span className="text-sm font-semibold text-foreground">{holders}</span>
          </div>
        )}
      </div>

      <button
        onClick={handleBuy}
        className="w-full relative py-2.5 rounded-lg font-semibold text-white transition-all duration-200
          brand-gradient
          shadow-[0_0_18px_4px_rgba(139,92,246,0.45)]
          hover:shadow-[0_0_26px_6px_rgba(139,92,246,0.6)]
          hover:brightness-110
          active:scale-[0.98]"
      >
        {comingSoon ? 'Coming Soon' : 'Buy Signal'}
      </button>
    </div>
  );
};
