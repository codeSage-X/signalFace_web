'use client';

import { useState } from 'react';
import { mockRewards } from '@/lib/mock';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/lib/stores';
import { CheckCircle, Gift } from 'lucide-react';

export default function RewardsPage() {
  const [claimed, setClaimed] = useState<Set<string>>(new Set());
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  const handleClaim = (rewardId: string, points: number) => {
    requireAuth(() => {
      if (!claimed.has(rewardId)) {
        setClaimed((prev) => new Set(prev).add(rewardId));
        addToast({
          message: `Claimed ${points} NXR Rewards!`,
          type: 'success',
          duration: 2000,
        });
      }
    });
  };

  const completedCount = claimed.size;
  const totalPoints = mockRewards.reduce((acc, r) => acc + (claimed.has(r.id) ? r.points : 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Rewards Center</h1>
        <p className="text-muted-foreground mt-2">
          Complete tasks and earn NXR tokens.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-6">
          <Gift size={24} className="text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Total Earned</p>
          <p className="text-2xl font-bold text-foreground">{totalPoints} NXR</p>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <CheckCircle size={24} className="text-up mb-2" />
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-foreground">{completedCount}/{mockRewards.length}</p>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <p className="text-sm text-muted-foreground">Available</p>
          <p className="text-2xl font-bold text-primary">{mockRewards.length - completedCount}</p>
        </div>
      </div>

      {/* Rewards List */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground mb-4">Available Tasks</h2>
        {mockRewards.map((reward) => {
          const isClaimed = claimed.has(reward.id);
          return (
            <div
              key={reward.id}
              className="glass-card rounded-2xl p-4 flex items-center justify-between glass-hover"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{reward.title}</h3>
                <p className="text-sm text-muted-foreground capitalize">
                  {reward.frequency === 'one-time' ? 'Claim once' : `${reward.frequency.charAt(0).toUpperCase() + reward.frequency.slice(1)}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-primary text-lg">+{reward.points}</p>
                  <p className="text-xs text-muted-foreground">NXR</p>
                </div>
                <button
                  onClick={() => handleClaim(reward.id, reward.points)}
                  disabled={isClaimed}
                  className={`px-6 py-2 rounded-lg font-semibold transition ${
                    isClaimed
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'brand-gradient hover:brightness-110 text-primary-foreground'
                  }`}
                >
                  {isClaimed ? 'Claimed ✓' : 'Claim'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
