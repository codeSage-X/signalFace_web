'use client';

import { mockActivity } from '@/lib/mock';
import { TrendingUp, TrendingDown, Gift } from 'lucide-react';

const getIcon = (action: string) => {
  if (action.includes('bought')) return <TrendingUp size={18} className="text-up" />;
  if (action.includes('sold')) return <TrendingDown size={18} className="text-destructive" />;
  return <Gift size={18} className="text-primary" />;
};

export default function ActivityPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Activity Feed</h1>
        <p className="text-muted-foreground mt-2">
          Track your recent transactions and portfolio activity.
        </p>
      </div>

      {/* Activity Timeline */}
      <div className="space-y-3">
        {mockActivity.map((activity, index) => (
          <div
            key={activity.id}
            className="flex items-start gap-4 p-4 glass-card rounded-2xl glass-hover"
          >
            {/* Timeline Dot */}
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center flex-shrink-0">
                {getIcon(activity.action)}
              </div>
              {index !== mockActivity.length - 1 && (
                <div className="w-0.5 h-12 bg-border mt-2" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 py-2">
              <p className="text-foreground font-medium">{activity.action}</p>
              <p className="text-sm text-muted-foreground">{activity.timestamp}</p>
            </div>

            {/* Points */}
            <div className="text-right py-2">
              <p className={`font-bold text-lg ${activity.points.startsWith('+') ? 'text-up' : 'text-down'}`}>
                {activity.points}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
