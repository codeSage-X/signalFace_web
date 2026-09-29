'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faBriefcase,
  faStore,
  faUserGroup,
} from '@fortawesome/free-solid-svg-icons';

// Four tabs flanking the upload button. Everything else the sidebar carries is
// reached from the drawer in the top bar — a tab bar can't hold twelve entries.
const leftItems = [
  { href: '/app/for-you', label: 'For You', icon: faFire },
  { href: '/app/signals', label: 'Signals', icon: faBriefcase },
];

const rightItems = [
  { href: '/app/market', label: 'Shopping Mall', icon: faStore },
  { href: '/app/friends', label: 'Friends', icon: faUserGroup },
];

const Tab = ({
  href,
  label,
  icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: typeof faFire;
  isActive: boolean;
}) => (
  <Link
    href={href}
    aria-current={isActive ? 'page' : undefined}
    className="min-w-0 flex-1 flex flex-col items-center justify-center py-2.5 gap-1 transition"
  >
    <span
      className={`flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-200 ${
        isActive ? 'brand-gradient text-white brand-glow' : 'text-muted-foreground'
      }`}
    >
      <FontAwesomeIcon icon={icon} className="h-4 w-4" />
    </span>
    <span
      className={`text-center text-[10px] sm:text-[11px] font-medium leading-tight ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
    >
      {label}
    </span>
  </Link>
);

export const BottomTabBar = () => {
  const pathname = usePathname();

  return (
    <div
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40
        bg-background/80 backdrop-blur-xl border-t border-white/[0.06]
        pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-stretch">
        {leftItems.map((item) => (
          <Tab key={item.href} {...item} isActive={pathname === item.href} />
        ))}

        {/* Upload sits in the middle and reads as an action, not a destination —
            so it gets the brand fill rather than the active-tab treatment. */}
        <div className="flex-1 flex items-center justify-center">
          <Link
            href="/app/upload"
            aria-label="Upload"
            className="flex items-center justify-center w-12 h-9 rounded-xl brand-gradient text-white
              shadow-lg brand-glow hover:brightness-110 active:scale-95 transition"
          >
            <Plus size={22} strokeWidth={2.5} />
          </Link>
        </div>

        {rightItems.map((item) => (
          <Tab key={item.href} {...item} isActive={pathname === item.href} />
        ))}
      </div>
    </div>
  );
};
