'use client';

import NextLink from 'next/link';
import { BadgeCheck, LayoutDashboard, Repeat, User } from 'lucide-react';
import { useAuth, useProfileMode } from '@/lib/stores';
import { useProfileSwitch } from '@/hooks/useCreatorProfile';

/**
 * The creator block shared by every profile menu.
 *
 * Before you have a realm this is a single "Become a creator" entry; once you do,
 * that same slot becomes the profile switcher — "Creator profile" while you're a
 * fan, "Fan profile" while you're in your realm — plus a link to the dashboard.
 */
export const CreatorMenuSection = ({ onDismiss }: { onDismiss?: () => void }) => {
  const { user } = useAuth();
  const setBecomeCreatorOpen = useProfileMode((s) => s.setBecomeCreatorOpen);
  const { mode, realm, isCreator, switchTo } = useProfileSwitch();

  // Nothing to offer a signed-out visitor.
  if (!user) return null;

  const itemClass =
    'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-sidebar-accent transition text-left';

  if (!isCreator) {
    return (
      <button
        role="menuitem"
        onClick={() => {
          onDismiss?.();
          setBecomeCreatorOpen(true);
        }}
        className={itemClass}
      >
        <BadgeCheck size={16} className="text-muted-foreground flex-shrink-0" />
        Become a creator
      </button>
    );
  }

  const inCreatorMode = mode === 'creator';

  return (
    <>
      <button
        role="menuitem"
        onClick={() => {
          onDismiss?.();
          switchTo(inCreatorMode ? 'fan' : 'creator');
        }}
        className={itemClass}
      >
        {/* The avatar of whichever identity you'd be moving into. */}
        <span className="w-6 h-6 rounded-full overflow-hidden brand-gradient flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
          {inCreatorMode ? (
            user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              (user.displayName?.charAt(0) ?? '?').toUpperCase()
            )
          ) : realm?.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={realm.iconUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            (realm?.name.charAt(0) ?? '?').toUpperCase()
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium truncate">
            {inCreatorMode ? 'Fan profile' : 'Creator profile'}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {inCreatorMode ? `@${user.username}` : realm?.name}
          </span>
        </span>

        <Repeat size={14} className="text-muted-foreground flex-shrink-0" />
      </button>

      <NextLink
        role="menuitem"
        href="/app/realm/dashboard"
        onClick={onDismiss}
        className={itemClass}
      >
        <LayoutDashboard size={16} className="text-muted-foreground flex-shrink-0" />
        Creator dashboard
      </NextLink>

      {!inCreatorMode && (
        <NextLink role="menuitem" href="/app/realm" onClick={onDismiss} className={itemClass}>
          <User size={16} className="text-muted-foreground flex-shrink-0" />
          Manage {realm?.name ?? 'realm'}
        </NextLink>
      )}
    </>
  );
};
