'use client';

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

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
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

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
      {src && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <UserRound size={iconSize} className={fill ? 'w-1/2 h-1/2' : undefined} strokeWidth={1.8} aria-label={name ? `${name} avatar` : 'User avatar'} />
      )}
    </span>
  );
};
