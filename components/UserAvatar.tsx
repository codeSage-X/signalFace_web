'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { avatarSource } from '@/lib/avatar-source';

function AvatarImage({ src, fallback }: { src: string | null; fallback: ReactNode }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!failed || attempt >= 1) return;
    const timer = setTimeout(() => { setAttempt(1); setFailed(false); }, 2_000);
    return () => clearTimeout(timer);
  }, [failed, attempt]);

  if (!src || failed) return fallback;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={attempt} src={src} alt="" referrerPolicy="no-referrer"
      className="w-full h-full object-cover" onError={() => setFailed(true)} />
  );
}

/**
 * Shared profile picture with a monochrome fallback. Fill mode inherits the
 * container's size and shape for page icons and larger profile previews.
 */
export const UserAvatar = ({
  src,
  name,
  size = 'md',
  ring = true,
  className = '',
  fill = false,
}: {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  className?: string;
  fill?: boolean;
}) => {
  const dim = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
    xl: 'w-28 h-28 text-5xl',
  }[size];

  const iconSize = { sm: 18, md: 24, lg: 32, xl: 54 }[size];

  return (
    <span
      className={`${fill ? 'w-full h-full rounded-[inherit]' : `${dim} rounded-full`} ${className} flex-shrink-0 overflow-hidden
        flex items-center justify-center bg-black text-white dark:bg-white dark:text-black
        ${ring ? 'ring-2 ring-white/15' : ''}`}
    >
      <AvatarImage key={src ?? ''} src={avatarSource(src)} fallback={
        <UserRound size={iconSize} className={fill ? 'w-1/2 h-1/2' : undefined} strokeWidth={1.8} aria-label={name ? `${name} avatar` : 'User avatar'} />
      } />
    </span>
  );
};
