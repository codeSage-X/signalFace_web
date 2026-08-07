'use client';

import { mockPosts, mockCreators } from '@/lib/mock';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { REALM_CATEGORY_LABELS, realmsApi, type Realm } from '@/lib/api';

const categories = ['All', 'Trending', 'Music', 'Technology', 'Finance', 'Lifestyle', 'Education', 'Entertainment'];

const TRENDING_REALMS = 6;

export default function ExplorePage() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [realms, setRealms] = useState<Realm[]>([]);
  const [realmsLoading, setRealmsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    realmsApi
      .list({ limit: TRENDING_REALMS })
      .then((page) => {
        if (!cancelled) setRealms(page.items);
      })
      // A failed strip shouldn't take the rest of Explore down with it.
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setRealmsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="sticky top-0 bg-background/70 backdrop-blur-xl z-30 border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-foreground mb-4">Explore</h1>
          
          {/* Category Filter */}
          <div className="flex gap-2 overflow-x-auto pb-4 -mb-4 scrollbar-hide">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'brand-gradient text-primary-foreground'
                    : 'glass-chip text-card-foreground hover:brightness-125'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Trending Posts Grid */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            Trending Now
            <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {mockPosts.map((post, idx) => (
              <div
                key={`${post.id}-${idx}`}
                className="glass-card rounded-2xl overflow-hidden glass-hover cursor-pointer group"
              >
                <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-4xl">
                  {post.avatar}
                </div>
                <div className="p-3">
                  <p className="font-semibold text-sm text-card-foreground line-clamp-2 group-hover:text-primary transition">
                    {post.creatorName}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{post.caption}</p>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>❤️ {post.likes}</span>
                    <span>💬 {post.comments}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Creators */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
            Top Creators
            <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mockCreators.slice(0, 6).map((creator) => (
              <Link
                key={creator.id}
                href={`/app/creators#${creator.id}`}
                className="glass-card rounded-2xl p-4 glass-hover"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-3xl">{creator.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-semibold text-card-foreground truncate">{creator.name}</p>
                      {creator.verified && <span className="text-primary text-xs">✓</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">{creator.category}</p>
                  </div>
                </div>
                <div className="flex justify-between text-xs mb-3">
                  <span className="text-muted-foreground">{creator.followers.toLocaleString()} followers</span>
                  <span className="text-primary font-semibold">${creator.signalPrice}</span>
                </div>
                <div className={`px-3 py-2 rounded-lg text-xs font-medium text-center transition ${
                  creator.change24h >= 0
                    ? 'bg-up/10 text-up'
                    : 'bg-down/10 text-down'
                }`}>
                  {creator.change24h >= 0 ? '+' : ''}{creator.change24h}% (24h)
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Trending Realms — real creator pages, newest first */}
        <div>
          <Link
            href="/app/realms"
            className="text-xl font-bold text-foreground mb-6 flex items-center gap-2 hover:underline w-fit"
          >
            Trending Realms
            <FontAwesomeIcon icon={faArrowRight} className="h-4 w-4" />
          </Link>

          {realmsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 rounded-2xl bg-white/[0.06] animate-pulse" />
              ))}
            </div>
          ) : realms.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="font-semibold text-foreground">No realms yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Creator pages will show up here as they launch.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {realms.map((realm) => (
                <Link
                  key={realm.id}
                  href={`/app/r/${realm.slug}`}
                  className="glass-card glass-hover rounded-2xl overflow-hidden block"
                >
                  <div className="relative h-20 bg-gradient-to-br from-violet-800 via-fuchsia-800 to-rose-900">
                    {realm.coverUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={realm.coverUrl} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="p-4 -mt-7 relative">
                    <div className="w-12 h-12 rounded-xl brand-gradient flex items-center justify-center text-lg font-bold text-white overflow-hidden ring-4 ring-background">
                      {realm.iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        realm.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <h3 className="mt-2.5 font-bold text-foreground truncate">{realm.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {REALM_CATEGORY_LABELS[realm.category]} ·{' '}
                      {realm.followersCount.toLocaleString()} followers
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
