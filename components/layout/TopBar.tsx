'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/stores';
import { Bell, MessageCircle, Settings, User, Briefcase, LogOut, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/ThemeToggle';
import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer';
import { CreatorMenuSection } from '@/components/creator/CreatorMenuSection';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';
import { UserAvatar } from '@/components/UserAvatar';

export const TopBar = ({
  unreadMessages = 0,
  unreadActivity = 0,
}: {
  unreadMessages?: number;
  unreadActivity?: number;
}) => {
  const { user, logout, setAuthModalOpen } = useAuth();
  const { mode, realm } = useProfileSwitch();
  const [open, setOpen] = useState(false);
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

  const openMobileSearch = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('search', '1');
    router.push(`${url.pathname}${url.search}`);
  };

  // In creator mode the chrome wears the realm's identity, so it's always
  // obvious which profile an action will be taken as.
  const asRealm = mode === 'creator' && Boolean(realm);
  // A Realm can be created before its own display picture is uploaded. Keep
  // the owner's profile picture visible in the header until the Realm gets one
  // instead of replacing a valid photo with the generic placeholder.
  const avatarUrl = asRealm ? (realm?.iconUrl ?? user?.avatarUrl) : user?.avatarUrl;
  const unreadMessagesLabel = unreadMessages > 99 ? '99+' : String(unreadMessages);
  const unreadActivityLabel = unreadActivity > 99 ? '99+' : String(unreadActivity);

  const avatar = (
    <button
      onClick={() => setOpen((o) => !o)}
      aria-label={asRealm ? `${realm?.name} menu` : 'Account menu'}
      className={`flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-full text-white font-semibold text-sm hover:brightness-110 transition focus:outline-none focus:ring-2 focus:ring-primary overflow-hidden flex-shrink-0 ${
        asRealm ? 'bg-black dark:bg-white' : 'bg-black dark:bg-white'
      } ${
        asRealm ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
      }`}
    >
      <UserAvatar src={avatarUrl} name={asRealm ? realm?.name : user?.displayName} fill ring={false} />
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

      <Link
        role="menuitem"
        href="/app/portfolio"
        onClick={() => setOpen(false)}
        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-sidebar-accent transition"
      >
        <Briefcase size={16} className="text-muted-foreground" />
        Portfolio
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
            title={
              unreadActivity > 0
                ? `${unreadActivity} new notification${unreadActivity === 1 ? '' : 's'}`
                : 'Notifications'
            }
            aria-label={
              unreadActivity > 0
                ? `Notifications, ${unreadActivity} new notification${unreadActivity === 1 ? '' : 's'}`
                : 'Notifications'
            }
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
          >
            <Bell size={19} />
            {unreadActivity > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[9px] font-bold leading-4 text-center shadow-sm shadow-primary/40">
                {unreadActivityLabel}
              </span>
            )}
          </Link>

          <Link
            href="/app/messages"
            title={
              unreadMessages > 0
                ? `${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}`
                : 'Chat'
            }
            aria-label={
              unreadMessages > 0
                ? `Chat, ${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}`
                : 'Chat'
            }
            className="relative w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition"
          >
            <MessageCircle size={19} />
            {unreadMessages > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[9px] font-bold leading-4 text-center shadow-sm shadow-primary/40">
                {unreadMessagesLabel}
              </span>
            )}
          </Link>

          <ThemeToggle />

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

      {/* Mobile: the drawer owns the brand and search affordance. */}
      <header className="lg:hidden flex h-14 items-center justify-between px-4 sticky top-0 z-30
        bg-background/70 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex w-full items-center gap-2">
          <MobileNavDrawer unreadMessages={unreadMessages} onSearch={openMobileSearch} />

          <div className="ml-auto flex min-w-0 flex-1 items-center justify-evenly gap-1">

          <Link
            href="/app/activity"
            aria-label={
              unreadActivity > 0
                ? `Notifications, ${unreadActivity} new notification${unreadActivity === 1 ? '' : 's'}`
                : 'Notifications'
            }
            className="relative text-muted-foreground hover:text-foreground transition p-1"
          >
            <Bell size={20} />
            {unreadActivity > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[9px] font-bold leading-4 text-center shadow-sm shadow-primary/40">
                {unreadActivityLabel}
              </span>
            )}
          </Link>

          <Link
            href="/app/messages"
            aria-label={
              unreadMessages > 0
                ? `Chat, ${unreadMessages} unread message${unreadMessages === 1 ? '' : 's'}`
                : 'Chat'
            }
            className="relative text-muted-foreground hover:text-foreground transition p-1"
          >
            <MessageCircle size={20} />
            {unreadMessages > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[9px] font-bold leading-4 text-center shadow-sm shadow-primary/40">
                {unreadMessagesLabel}
              </span>
            )}
          </Link>

          <ThemeToggle />

          {user ? (
            <div className="relative" ref={mobileRef}>
              {avatar}
              {dropdown}
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="whitespace-nowrap rounded-lg brand-gradient px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110 transition"
            >
              Sign in
            </button>
          )}
          </div>
        </div>
      </header>
    </>
  );
};
