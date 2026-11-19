'use client';

import { ArrowRight, Gem, Heart, HeartHandshake, Search, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Category = {
  title: string;
  blurb: string;
  icon: LucideIcon;
  gradient: string;
};

const CATEGORIES: Category[] = [
  {
    title: 'Meaningful Connections',
    blurb: 'Meet people with shared interests.',
    icon: Users,
    gradient: 'from-violet-600 to-purple-800',
  },
  {
    title: 'Dating',
    blurb: 'Explore romantic connections.',
    icon: Heart,
    gradient: 'from-pink-500 to-rose-700',
  },
  {
    title: 'Life Partner',
    blurb: 'Find someone for life.',
    icon: Gem,
    gradient: 'from-indigo-600 to-violet-800',
  },
  {
    title: 'Marriage Intentions',
    blurb: 'Meet your future spouse.',
    icon: HeartHandshake,
    gradient: 'from-fuchsia-500 to-pink-700',
  },
  {
    title: 'Discover People',
    blurb: 'Explore new profiles.',
    icon: Search,
    gradient: 'from-blue-600 to-indigo-800',
  },
];

export function LifeConnectionsBanner({ onExplore }: { onExplore: (category: string) => void }) {
  return (
    <section className="space-y-4">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a0b3d] via-[#3b0f6b] to-[#a3197a] p-6 sm:p-8">
        <Heart
          aria-hidden
          className="absolute right-6 top-4 h-24 w-24 sm:h-32 sm:w-32 text-pink-400/20 fill-pink-400/20 rotate-12"
        />
        <Heart
          aria-hidden
          className="absolute right-32 bottom-2 h-12 w-12 text-pink-300/15 fill-pink-300/15 -rotate-12 hidden sm:block"
        />
        <div className="relative flex items-center gap-4">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-lg shadow-pink-500/30">
            <HeartHandshake className="h-8 w-8 sm:h-9 sm:w-9 text-white" />
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold leading-tight text-white">
            Life <span className="text-pink-400">Connections</span>
          </h2>
        </div>
        <p className="relative mt-4 max-w-xl text-base sm:text-lg font-medium text-white/90">
          Meet people. Build meaningful relationships. Discover possibilities.
        </p>
        <div className="relative mt-3 h-1 w-32 rounded-full bg-gradient-to-r from-pink-500 to-transparent" />
      </div>

      {/* Categories */}
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
        {CATEGORIES.map(({ title, blurb, icon: Icon, gradient }) => (
          <button
            key={title}
            type="button"
            onClick={() => onExplore(title)}
            className={`group relative flex min-w-[160px] flex-col items-start rounded-2xl bg-gradient-to-br ${gradient} p-4 text-left text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70`}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
              <Icon className="h-5 w-5" />
            </span>
            <span className="mt-3 font-bold leading-tight">{title}</span>
            <span className="mt-1 pr-8 text-xs text-white/85">{blurb}</span>
            <span className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/25 transition group-hover:bg-white/40">
              <ArrowRight className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
