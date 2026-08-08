'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faSignOut, faUpload } from '@fortawesome/free-solid-svg-icons';
import { BrandMark } from '@/components/BrandMark';
import { navItems } from '@/components/layout/Sidebar';
import { useAuth } from '@/lib/stores';

/**
 * The tab bar can hold four destinations; the sidebar lists eleven. This drawer
 * is where the rest live on mobile, reusing the sidebar's `navItems` so the two
 * can't drift apart.
 */
export const MobileNavDrawer = () => {
  const [open, setOpen] = useState(false);
  // `createPortal` needs a DOM, which the server render doesn't have.
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Any navigation closes the drawer — including taps on the item already active.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);

    // The panel scrolls on its own; the page behind it shouldn't.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="lg:hidden text-muted-foreground hover:text-foreground transition p-1 -ml-1"
      >
        <Menu size={22} />
      </button>

      {/* Portalled to <body> deliberately. The mobile header carries
          `backdrop-blur-xl`, and backdrop-filter makes an element a containing
          block for its fixed-position descendants — so rendering the drawer in
          place pinned it to the header's box instead of the viewport, and the
          header's own `z-30` capped it under the feed. From <body> it covers
          everything, which is the whole point of a drawer. */}
      {mounted &&
        open &&
        createPortal(
          <div className="lg:hidden fixed inset-0 z-[100]">
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setOpen(false)}
            />

            <div
              role="dialog"
              aria-modal="true"
              aria-label="Navigation"
              className="absolute inset-y-0 left-0 w-[82%] max-w-xs flex flex-col
                bg-background/95 backdrop-blur-xl border-r border-white/[0.06] shadow-2xl
                animate-in slide-in-from-left duration-200"
            >
            {/* Same red bloom the sidebar uses, so the drawer reads as the same surface. */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -left-16 h-64 w-64 rounded-full blur-[110px]"
              style={{ backgroundColor: 'rgba(196, 20, 63, 0.32)' }}
            />

            <div className="relative z-10 flex items-center justify-between px-4 h-14 border-b border-white/[0.06]">
              <Link href="/app/for-you" className="flex items-center gap-2">
                <BrandMark size="sm" />
                <span className="font-bold text-foreground text-sm tracking-wide">
                  SIGNAL FACE
                </span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-muted-foreground hover:text-foreground transition p-1"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="relative z-10 flex-1 overflow-y-auto p-3 space-y-1">
              <Link
                href="/app/upload"
                className="flex items-center gap-3 px-4 py-3 mb-2 rounded-xl brand-gradient
                  text-white font-semibold brand-glow hover:brightness-110 transition"
              >
                <FontAwesomeIcon icon={faUpload} className="h-4 w-4" />
                <span className="text-sm">Upload</span>
              </Link>

              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${
                      isActive
                        ? 'bg-white/[0.08] text-white font-semibold'
                        : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
                    <span className="text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div
              className="relative z-10 p-3 space-y-1 border-t"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}
            >
              <Link
                href="/app/settings"
                className="flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/[0.06] hover:text-white rounded-xl transition"
              >
                <FontAwesomeIcon icon={faGear} className="h-4 w-4" />
                <span className="text-sm">Settings</span>
              </Link>
              {user && (
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                    router.push('/');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-destructive hover:bg-destructive/10 rounded-xl transition"
                >
                  <FontAwesomeIcon icon={faSignOut} className="h-4 w-4" />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              )}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
};
