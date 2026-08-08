'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/stores';
import { Bell, Search, Settings, User, LogOut, X, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/BrandMark';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';
import { CreatorMenuSection } from '@/components/creator/CreatorMenuSection';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';

export const TopBar = () => {
  const { user, logout, setAuthModalOpen } = useAuth();
  const { mode, realm } = useProfileSwitch();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Both breakpoint variants exist in the DOM (CSS decides which shows), so a
  // single ref would only ever point at one of them.
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside =
        desktopRef.current?.contains(target) || mobileRef.current?.contains(target);
      if (!inside) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    logout();
    setOpen(false);
    router.push('/');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase()
    : '?';

  // In creator mode the chrome wears the realm's identity, so it's always
  // obvious which profile an action will be taken as.
  const asRealm = mode === 'creator' && Boolean(realm);
  const avatarUrl = asRealm ? realm?.iconUrl : user?.avatarUrl;
  const avatarFallback = asRealm ? (realm?.name.charAt(0).toUpperCase() ?? '?') : initials;

  const avatar = (
    <button
      onClick={() => setOpen((o) => !o)}
      aria-label={asRealm ? `${realm?.name} menu` : 'Account menu'}
      className={`flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white font-semibold text-sm hover:brightness-110 transition focus:outline-none focus:ring-2 focus:ring-primary overflow-hidden flex-shrink-0 ${
        asRealm ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        avatarFallback
      )}
    </button>
  );

  const dropdown = user && open && (
    <div
      role="menu"
      className="absolute right-0 top-12 w-64 glass-card rounded-xl shadow-2xl py-1 z-50"
    >
      <div className="px-4 py-2.5">
        <p className="text-sm font-semibold text-foreground truncate">
          {asRealm ? realm?.name : user.displayName}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          @{asRealm ? realm?.slug : user.username}
        </p>
        {asRealm && (
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold brand-gradient text-white">
            Creator profile
          </span>
        )}
      </div>

      <div className="h-px bg-border my-1" />

      <Link
        role="menuitem"
        href={asRealm ? '/app/realm' : '/app/profile'}
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-sidebar-accent transition"
      >
        <User size={16} className="text-muted-foreground" />
        View profile
      </Link>

      <CreatorMenuSection onDismiss={() => setOpen(false)} />

      <div className="h-px bg-border my-1" />

      <Link
        role="menuitem"
        href="/app/settings"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-sidebar-accent transition"
      >
        <Settings size={16} className="text-muted-foreground" />
        Settings
      </Link>
      <button
        role="menuitem"
        onClick={handleLogout}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition"
      >
        <LogOut size={16} />
        Log out
      </button>
    </div>
  );

  return (
    <>
      {/* Desktop: floating action pill, top-right. Search lives in the sidebar,
          so there's no full-width bar to reserve vertical space. */}
      <div className="hidden lg:block fixed top-4 right-6 z-40" ref={desktopRef}>
        <div className="flex items-center gap-1 glass-chip rounded-full pl-2 pr-1.5 py-1.5 shadow-lg">
          <Link
            href="/app/activity"
            title="Notifications"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
          >
            <Bell size={19} />
          </Link>

          {/* Upload replaced Settings here — Settings is still one click away in the
              sidebar footer and the account menu below, whereas uploading had no
              home outside a nav list. */}
          <Link
            href="/app/upload"
            title="Upload"
            aria-label="Upload"
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
          >
            <Plus size={21} strokeWidth={2.5} />
          </Link>

          {user ? (
            avatar
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-3.5 py-1.5 text-sm font-semibold brand-gradient text-white rounded-full hover:brightness-110 transition"
            >
              Sign in
            </button>
          )}
        </div>

        {dropdown}
      </div>

      {/* Mobile: there's no sidebar, so the bar still carries brand + search */}
      <header className="lg:hidden flex h-14 items-center justify-between px-4 sticky top-0 z-30
        bg-background/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <MobileNavDrawer />
          <Link href="/app/for-you" className="flex items-center gap-2 min-w-0">
            <BrandMark size="sm" />
            <span className="font-bold text-foreground text-base tracking-wide truncate">
              SIGNAL FACE
            </span>
          </Link>
        </div>

        {searchOpen && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-xl flex items-center px-4 gap-3 z-10">
            <Search size={18} className="text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search creators, realms, signals..."
              className="flex-1 bg-transparent focus:outline-none text-foreground placeholder-muted-foreground text-sm"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="text-muted-foreground hover:text-foreground transition"
            >
              <X size={20} />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="text-muted-foreground hover:text-foreground transition p-1"
          >
            <Search size={20} />
          </button>

          <Link href="/app/activity" className="text-muted-foreground hover:text-foreground transition p-1">
            <Bell size={20} />
          </Link>

          {user ? (
            <div className="relative" ref={mobileRef}>
              {avatar}
              {dropdown}
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="px-3 py-1.5 text-sm font-semibold brand-gradient text-white rounded-lg hover:brightness-110 transition"
            >
              Sign in
            </button>
          )}
        </div>
      </header>
    </>
  );
};
