'use client';

/**
 * A person's picture. Always a circle — people are round, pages are rounded
 * squares (see the realm treatment in the feed's action column), which is the
 * same visual grammar Instagram and Facebook use to separate the two.
 */
export const UserAvatar = ({
  src,
  name,
  size = 'md',
  ring = true,
  className = '',
}: {
  src?: string | null;
  name?: string | null;
  size?: 'sm' | 'md' | 'lg';
  ring?: boolean;
  className?: string;
}) => {
  const dim = {
    sm: 'w-9 h-9 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-lg',
  }[size];

  const initials = (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <span
      className={`${dim} ${className} flex-shrink-0 rounded-full overflow-hidden
        flex items-center justify-center font-bold text-white
        bg-gradient-to-br from-violet-500 to-fuchsia-500
        ${ring ? 'ring-2 ring-white/15' : ''}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="w-full h-full object-cover" />
      ) : (
        (initials || '?')
      )}
    </span>
  );
};
