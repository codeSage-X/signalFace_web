'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faFire,
  faChartLine,
  faUsers,
  faBoltLightning,
} from '@fortawesome/free-solid-svg-icons';

// Mirrors the sidebar: no dashboard tab, For You is the landing surface.
const navItems = [
  { href: '/app/for-you', label: 'For You', icon: faFire },
  { href: '/app/explore', label: 'Explore', icon: faChartLine },
  { href: '/app/creators', label: 'Creators', icon: faUsers },
  { href: '/app/friends', label: 'Friends', icon: faUsers },
];

export const BottomTabBar = () => {
  const pathname = usePathname();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40
      bg-background/80 backdrop-blur-xl border-t border-white/[0.06]">
      <div className="flex justify-around">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-3 gap-1 transition"
            >
              <span
                className={`flex items-center justify-center w-10 h-8 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'brand-gradient text-white brand-glow'
                    : 'text-muted-foreground'
                }`}
              >
                <FontAwesomeIcon icon={item.icon} className="h-4 w-4" />
              </span>
              <span
                className={`text-xs font-medium ${isActive ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
