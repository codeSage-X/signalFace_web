'use client';

import { useState, useCallback } from 'react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const toasts: Toast[] = [];

export const useToast = () => {
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString();
    const toast: Toast = { id, message, type };
    toasts.push(toast);

    // Log toast to console (simple implementation for now)
    console.log(`[Toast] ${type.toUpperCase()}: ${message}`);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      const index = toasts.indexOf(toast);
      if (index > -1) toasts.splice(index, 1);
    }, 3000);

    return id;
  }, []);

  return { showToast };
};
