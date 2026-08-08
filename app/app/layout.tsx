'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { AuthGateModal } from '@/components/auth/AuthGateModal';
import { BecomeCreatorModal } from '@/components/creator/BecomeCreatorModal';
import { ProfileSwitchOverlay } from '@/components/creator/ProfileSwitchOverlay';
import { Toaster } from '@/components/Toast';
import { useMyRealmSync } from '@/hooks/useCreatorProfile';
import { useProfileMode } from '@/lib/stores';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // One place owns fetching the viewer's realm; the rest of the app reads it
  // from the store.
  useMyRealmSync();
  const { becomeCreatorOpen, setBecomeCreatorOpen } = useProfileMode();

  // The feed runs edge-to-edge behind the tab bar, so it can't reserve space for
  // it the way the scrolling pages do.
  const pathname = usePathname();
  const immersive = pathname === '/app/for-you';

  return (
    <div className="flex h-screen bg-background">
      {/* What every glass surface in the app blurs against. Fixed and inert, so
          it neither scrolls with the feed nor eats pointer events. */}
      <div aria-hidden className="app-ambient" />

      <Sidebar />
      <div className="relative z-10 flex-1 flex flex-col lg:ml-64 min-w-0">
        <TopBar />
        <main
          className={`flex-1 overflow-y-auto min-h-0 ${immersive ? '' : 'pb-20 lg:pb-0'}`}
        >
          {children}
        </main>
        <BottomTabBar />
      </div>
      <AuthGateModal />
      <BecomeCreatorModal
        open={becomeCreatorOpen}
        onClose={() => setBecomeCreatorOpen(false)}
      />
      {/* Sits above everything, including the modals it may follow. */}
      <ProfileSwitchOverlay />
      <Toaster />
    </div>
  );
}
