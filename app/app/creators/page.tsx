'use client';

import { useState } from 'react';
import { mockCreators } from '@/lib/mock';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useToast } from '@/lib/stores';
import { Search, Heart } from 'lucide-react';

export default function CreatorsPage() {
  const [search, setSearch] = useState('');
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const { requireAuth } = useRequireAuth();
  const { addToast } = useToast();

  const filteredCreators = mockCreators.filter((creator) =>
    creator.name.toLowerCase().includes(search.toLowerCase()) ||
    creator.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleLike = (creatorId: string) => {
    requireAuth(() => {
      setLiked((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(creatorId)) {
          newSet.delete(creatorId);
          addToast({
            message: 'Removed from favorites',
            type: 'info',
            duration: 2000,
          });
        } else {
          newSet.add(creatorId);
          addToast({
            message: 'Added to favorites!',
            type: 'success',
            duration: 2000,
          });
        }
        return newSet;
      });
    });
  };

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Top Creators</h1>
        <p className="text-muted-foreground mt-2">
          Invest in your favorite creators and watch them grow.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search creators by name or category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-3 glass-input rounded-xl text-foreground placeholder-muted-foreground"
        />
      </div>

      {/* Creators Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCreators.map((creator) => (
          <div key={creator.id} className="glass-card rounded-2xl p-6 glass-hover">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="text-4xl">{creator.avatar}</div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-foreground">{creator.name}</h3>
                    {creator.verified && <span className="text-primary">✓</span>}
                  </div>
                  <p className="text-sm text-muted-foreground">{creator.category}</p>
                </div>
              </div>
              <button
                onClick={() => handleLike(creator.id)}
                className={`${
                  liked.has(creator.id) ? 'text-primary' : 'text-muted-foreground hover:text-primary'
                } transition`}
              >
                <Heart size={20} fill={liked.has(creator.id) ? 'currentColor' : 'none'} />
              </button>
            </div>

            <div className="space-y-2 pb-4 border-b border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Followers</span>
                <span className="text-sm font-semibold text-foreground">
                  {(creator.followers / 1000).toFixed(0)}K
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Signal Price</span>
                <span className="text-sm font-bold text-primary">${creator.signalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">24h Change</span>
                <span className="text-sm font-semibold text-up">+{creator.change24h}%</span>
              </div>
            </div>

            <button className="w-full mt-4 brand-gradient hover:brightness-110 text-primary-foreground font-semibold py-2 rounded-lg transition">
              View Profile
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
