'use client';

import { MapPin, Package } from 'lucide-react';
import type { MarketplaceListing } from '@/lib/api';
import { conditionLabel, money, relativeDate } from './market-utils';

export function ProductCard({ listing, onOpen }: { listing: MarketplaceListing; onOpen: () => void }) {
  return (
    <article className="group min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {listing.imageUrls[0] ? (
            <img src={listing.imageUrls[0]} alt={listing.title} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          ) : <Package className="absolute inset-0 m-auto text-muted-foreground" size={32} />}
          <span className="absolute left-2 top-2 rounded bg-background/90 px-2 py-1 text-[11px] font-semibold text-foreground backdrop-blur">{conditionLabel(listing.condition)}</span>
        </div>
        <div className="p-3">
          <h2 className="truncate text-sm font-medium text-foreground">{listing.title}</h2>
          <p className="mt-1 truncate text-xs text-muted-foreground">{listing.shop?.name}</p>
          <p className="mt-1 text-lg font-bold text-foreground">{money(listing.price)}</p>
          {listing.negotiable && <p className="text-xs font-medium text-primary">Negotiable</p>}
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="flex min-w-0 items-center gap-1 truncate"><MapPin size={12} className="shrink-0" /> {listing.location}</span>
            <span className="shrink-0">{relativeDate(listing.createdAt)}</span>
          </div>
        </div>
      </button>
    </article>
  );
}

