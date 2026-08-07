'use client';

import { useToast } from '@/lib/stores';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useEffect } from 'react';

const ToastIcon = ({ type }: { type: 'success' | 'error' | 'info' }) => {
  switch (type) {
    case 'success':
      return <CheckCircle size={20} className="text-up" />;
    case 'error':
      return <AlertCircle size={20} className="text-destructive" />;
    case 'info':
      return <Info size={20} className="text-accent" />;
  }
};

export const Toaster = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed top-4 right-4 z-[200] space-y-3">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="glass-card rounded-2xl p-4 flex items-center gap-3 min-w-[300px] shadow-lg animate-in fade-in slide-in-from-right-2 duration-300"
        >
          <ToastIcon type={toast.type} />
          <p className="text-foreground flex-1 text-sm">{toast.message}</p>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
