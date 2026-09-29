'use client';

import { useEffect, useRef, type ReactNode } from 'react';

export function MallDialog({ title, busy, onClose, children, wide = false }: {
  title: string; busy?: boolean; onClose: () => void; children: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, []);
  return (
    <dialog ref={ref} aria-label={title}
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className={`fixed inset-0 m-auto h-dvh max-h-dvh w-full max-w-none overflow-y-auto border-0 bg-background p-0 text-foreground backdrop:bg-black/75 sm:h-auto sm:max-h-[90dvh] sm:rounded-xl sm:border sm:border-border ${wide ? 'sm:max-w-6xl' : 'sm:max-w-2xl'}`}
    >
      {children}
    </dialog>
  );
}
