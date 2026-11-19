'use client';

import { ArrowRight, Heart, Search, Users } from 'lucide-react';
import { RingsIcon, type LifeFilter } from './lifeInterests';

type IconProps = { className?: string };

type Category = {
  /** What tapping the card filters Meet People to. */
  filter: LifeFilter;
  title: string;
  blurb: string;
  image: string;
  icon: (p: IconProps) => React.ReactElement;
  /** panel colour (bottom half) */
  panel: string;
  /** icon bubble + arrow tint */
  accent: string;
  /** blurb alignment, as in the design */
  align: 'left' | 'center';
};

const CATEGORIES: Category[] = [
  {
    filter: 'MEANINGFUL_CONNECTIONS',
    title: 'Meaningful Connections',
    blurb: 'Meet people with shared interests.',
    image: '/life-connections/meaningful_connections.png',
    icon: (p) => <Users {...p} />,
    panel: 'from-[#7b2ff7] to-[#4b12b8]',
    accent: 'bg-[#8f45ff]',
    align: 'left',
  },
  {
    filter: 'DATING',
    title: 'Dating',
    blurb: 'Explore romantic connections.',
    image: '/life-connections/dating.png',
    icon: (p) => <Heart {...p} />,
    panel: 'from-[#f0329a] to-[#c3127a]',
    accent: 'bg-[#f552ab]',
    align: 'center',
  },
  {
    filter: 'LIFE_PARTNER',
    title: 'Life Partner',
    blurb: 'Find someone for life.',
    image: '/life-connections/life_partner.png',
    icon: (p) => <RingsIcon {...p} />,
    panel: 'from-[#3b2fe0] to-[#2a1aa8]',
    accent: 'bg-[#5146f0]',
    align: 'left',
  },
  {
    filter: 'MARRIAGE_INTENTIONS',
    title: 'Marriage Intentions',
    blurb: 'Meet your future spouse.',
    image: '/life-connections/marriage_intentions.png',
    icon: (p) => <RingsIcon gem {...p} />,
    panel: 'from-[#f23a8e] to-[#cf1c74]',
    accent: 'bg-[#f65aa3]',
    align: 'center',
  },
  {
    // Everybody — no interest restriction.
    filter: 'ALL',
    title: 'Discover People',
    blurb: 'Explore new profiles.',
    image: '/life-connections/discover_people.png',
    icon: (p) => <Search {...p} />,
    panel: 'from-[#2563eb] to-[#1d3fbf]',
    accent: 'bg-[#3b7bf5]',
    align: 'center',
  },
];

/**
 * The Life Connections header. The five cards double as the Meet People
 * filter: one active at a time, Discover People meaning Everybody.
 */
export function LifeConnectionsBanner({
  active,
  onSelect,
}: {
  /** Highlighted card, or null when no filter is on screen (Connected tab). */
  active: LifeFilter | null;
  onSelect: (filter: LifeFilter) => void;
}) {
  return (
    <section className="space-y-4">
      {/* Hero — the artwork carries its own title and tagline */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/life-connections/banner.jpg"
        alt="Life Connections — Meet people. Build meaningful relationships. Discover possibilities."
        width={2000}
        height={667}
        className="block w-full h-auto rounded-2xl"
      />

      {/* Categories — tall portrait cards */}
      <div role="radiogroup" aria-label="Filter people by interest" className="flex gap-3 sm:gap-4 overflow-x-auto pb-1 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-5 lg:overflow-visible">
        {CATEGORIES.map(({ filter, title, blurb, image, icon: Icon, panel, accent, align }) => {
          const isActive = active === filter;
          return (
          <button
            key={title}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onSelect(filter)}
            className={`group relative aspect-[3/5] w-[200px] sm:w-[220px] lg:w-auto shrink-0 snap-start overflow-hidden rounded-[20px] text-white transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
              isActive
                ? '-translate-y-1 ring-[3px] ring-white/90 shadow-[0_0_28px_rgba(190,120,255,0.75)]'
                : 'ring-1 ring-white/25 shadow-[0_0_18px_rgba(140,90,255,0.35)] hover:shadow-[0_0_26px_rgba(160,110,255,0.55)]'
            }`}
          >
            {/* Background photo */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image}
              alt=""
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover object-top transition duration-500 group-hover:scale-105"
            />

            {/* Colour panel — bottom half, hard top edge */}
            <div className={`absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-b ${panel} opacity-[0.93]`} />

            {/* Icon bubble straddling the edge */}
            <span
              className={`absolute left-1/2 top-1/2 flex h-[22%] aspect-square max-h-[76px] -translate-x-1/2 -translate-y-[45%] items-center justify-center rounded-full ${accent} bg-opacity-90 shadow-[0_0_16px_rgba(255,255,255,0.25)] ring-[3px] ring-white/15`}
            >
              <Icon className="h-[46%] w-[46%]" />
            </span>

            {/* Text */}
            <div className="absolute inset-x-0 bottom-0 top-[63%] flex flex-col px-4 pb-4">
              <span className="text-center text-[17px] sm:text-[19px] font-bold leading-[1.15] tracking-tight">
                {title}
              </span>
              <span
                className={`mt-auto pr-9 text-[13px] sm:text-[14px] leading-snug text-white/90 ${
                  align === 'center' ? 'text-center pl-9' : 'text-left'
                }`}
              >
                {blurb}
              </span>
            </div>

            {/* Arrow */}
            <span
              className={`absolute bottom-3.5 right-3.5 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full ${accent} ring-1 ring-white/30 shadow-md transition group-hover:brightness-125`}
            >
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.5} />
            </span>
          </button>
          );
        })}
      </div>
    </section>
  );
}
