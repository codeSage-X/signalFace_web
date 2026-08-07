'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

export const StatCard = ({
  label,
  value,
  change,
  icon: Icon,
  color = 'from-primary',
}: {
  label: string;
  value: string | number;
  change?: number;
  icon?: React.ComponentType<{ size: number; className?: string }>;
  color?: string;
}) => {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="glass-card glass-hover rounded-2xl p-4 lg:p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-xl lg:text-2xl font-bold text-foreground">{value}</p>
        </div>
        {Icon && (
          <div className={`bg-gradient-to-br ${color} to-secondary p-3 rounded-lg`}>
            <Icon size={24} className="text-white" />
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {isPositive ? (
            <TrendingUp size={16} className="text-up" />
          ) : (
            <TrendingDown size={16} className="text-destructive" />
          )}
          <span className={isPositive ? 'text-up' : 'text-down'}>
            {isPositive ? '+' : ''}{change}%
          </span>
          <span className="text-muted-foreground text-xs">(24h)</span>
        </div>
      )}
    </div>
  );
};
