'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/lib/stores';
import { walletApi } from '@/lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartLine,
  faUsers,
  faFire,
  faBriefcase,
  faHeart,
  faGift,
  faHistory,
  faCompass,
  faUserGroup,
  faComments,
  faGear,
  faSignOut,
} from '@fortawesome/free-solid-svg-icons';

// Dashboard is deliberately absent — it's reached from the profile page instead,
// and Upload lives in the top bar's action pill rather than the nav list.
// Exported so the mobile drawer offers exactly the same destinations.
export const navItems = [
  { href: '/app/for-you', label: 'For You', icon: faFire },
  { href: '/app/explore', label: 'Explore', icon: faCompass },
  { href: '/app/creators', label: 'Creators', icon: faUsers },
  { href: '/app/friends', label: 'Friends', icon: faUserGroup },
  { href: '/app/messages', label: 'Messages', icon: faComments },
  { href: '/app/market', label: 'Market', icon: faChartLine },
  { href: '/app/signals', label: 'Signals', icon: faBriefcase },
  { href: '/app/watchlist', label: 'Watchlist', icon: faHeart },
  { href: '/app/rewards', label: 'Rewards', icon: faGift },
  { href: '/app/activity', label: 'Activity', icon: faHistory },
];

export const Sidebar = ({ unreadMessages = 0 }: { unreadMessages?: number }) => {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const unreadLabel = unreadMessages > 99 ? '99+' : String(unreadMessages);

  useEffect(() => {
    if (!isAuthenticated) {
      setBalance(null);
      return;
    }

    let cancelled = false;
    walletApi
      .getMe()
      .then((w) => {
        if (!cancelled) setBalance(Number(w.pointsBalance));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div
      className="hidden lg:flex h-screen w-64 flex-col fixed left-0 top-0 z-40 overflow-hidden
        backdrop-blur-xl border-r"
      style={{
        backgroundColor: 'rgba(8, 6, 12, 0.82)',
        borderColor: 'rgba(255, 255, 255, 0.06)',
        boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.03)',
      }}
    >
      {/* Ambient red bloom — what the glass panels below blur against. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -left-16 h-64 w-64 rounded-full blur-[110px]"
        style={{ backgroundColor: 'rgba(196, 20, 63, 0.32)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-10 -right-20 h-64 w-64 rounded-full blur-[120px]"
        style={{ backgroundColor: 'rgba(236, 44, 99, 0.20)' }}
      />

      <div className="relative z-10 flex flex-col h-full">
        {/* Logo */}
        <div className="px-6 pt-6 pb-4">
          <Link href="/app/for-you" className="flex items-center gap-3">
            <BrandMark size="md" />
            <div>
              <h1 className="text-lg font-bold text-white">SIGNAL FACE</h1>
              <p className="text-xs text-white/45">Own the Future</p>
            </div>
          </Link>
        </div>

        {/* Search — lives here rather than in a top bar. Submitting hands off to
            the search page, which owns the query from the URL. */}
        <div className="px-4 pb-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const term = searchDraft.trim();
              if (!term) return;
              router.push(`/app/search?q=${encodeURIComponent(term)}`);
            }}
            className="relative"
          >
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search"
              aria-label="Search"
              className="w-full pl-10 pr-4 py-2.5 rounded-full text-sm text-white placeholder-white/40
                border border-white/10 bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </form>
        </div>

        {/* Nav + panels share one scroll area so short viewports still reach the cards. */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={
                  item.href === '/app/messages' && unreadMessages > 0
                    ? `Messages, ${unreadMessages} unread`
                    : item.label
                }
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'brand-gradient text-white font-semibold brand-glow'
                    : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0 flex-1">
                  <FontAwesomeIcon icon={item.icon} className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm truncate">{item.label}</span>
                </span>
                {item.href === '/app/messages' && unreadMessages > 0 && (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold leading-5 text-center shadow-sm shadow-primary/40">
                    {unreadLabel}
                  </span>
                )}
              </Link>
            );
          })}

          {/* Panels get their own spacing block — `space-y-2` above governs the
              nav links only. */}
          <div className="pt-3 space-y-3">
            {/* Signal balance */}
            <div className="glass-card rounded-2xl p-4">
              <p className="text-xs text-white/55">SignalBalance</p>
              <p className="mt-1 text-lg font-bold text-white">
                <span className="text-primary">SF</span>{' '}
                {balance === null
                  ? '—'
                  : balance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
              </p>
              <p className="text-xs text-white/40">Available to trade</p>
              <button
                onClick={() => router.push('/app/portfolio#deposit')}
                className="mt-3 w-full brand-gradient text-white text-sm font-semibold py-2 rounded-xl
                hover:brightness-110 transition"
              >
                Top Up
              </button>
            </div>

            {/* Refer & earn */}
            <div className="glass-brand rounded-2xl p-4">
              <p className="text-sm font-bold text-white">Refer &amp; Earn</p>
              <p className="mt-1 text-xs text-white/60 leading-relaxed">
                Invite friends and earn <span className="text-primary font-semibold">20%</span> of
                their trading fee
              </p>

              {/* Three-friend motif from the design. */}
              <div aria-hidden className="flex items-end justify-center gap-1 my-3">
                {[
                  { h: 'h-8', from: '#8B5CF6', to: '#6D28D9' },
                  { h: 'h-9', from: '#EC2C63', to: '#C4143F' },
                  { h: 'h-8', from: '#8B5CF6', to: '#6D28D9' },
                ].map((f, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span
                      className="w-5 h-5 rounded-full"
                      style={{
                        backgroundImage: `linear-gradient(160deg, ${f.from}, ${f.to})`,
                      }}
                    />
                    <span
                      className={`${f.h} w-7 rounded-t-full -mt-0.5`}
                      style={{
                        backgroundImage: `linear-gradient(160deg, ${f.from}, ${f.to})`,
                      }}
                    />
                  </div>
                ))}
              </div>

              <Link
                href="/app/rewards#invite-friends"
                className="w-full brand-gradient text-white text-sm font-semibold py-2 rounded-xl
                hover:brightness-110 transition inline-flex items-center justify-center"
              >
                Invite Now
              </Link>
            </div>
          </div>
        </nav>

        {/* Settings & logout */}
        <div className="p-4 space-y-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <Link
            href="/app/settings"
            className="flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/[0.06] hover:text-white rounded-lg transition"
          >
            <FontAwesomeIcon icon={faGear} className="h-5 w-5" />
            <span className="text-sm">Settings</span>
          </Link>
          <button
            onClick={() => {
              logout();
              router.push('/');
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-lg transition"
          >
            <FontAwesomeIcon icon={faSignOut} className="h-5 w-5" />
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
