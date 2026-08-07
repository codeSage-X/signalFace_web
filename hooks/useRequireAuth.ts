'use client';

import { useCallback } from 'react';
import { useAuth } from '@/lib/stores';

export const useRequireAuth = () => {
  const { isAuthenticated, setAuthModalOpen } = useAuth();

  const requireAuth = useCallback(
    (callback: () => void) => {
      if (!isAuthenticated) {
        setAuthModalOpen(true);
        return;
      }
      callback();
    },
    [isAuthenticated, setAuthModalOpen]
  );

  return { requireAuth };
};
