import Image from 'next/image';

const sizeMap = {
  sm: { className: 'w-6 h-6 rounded-lg', px: 24 },
  md: { className: 'w-8 h-8 rounded-xl', px: 32 },
  lg: { className: 'w-12 h-12 rounded-xl', px: 48 },
};

export const BrandMark = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const { className, px } = sizeMap[size];

  return (
    <div
      className={`${className} bg-black overflow-hidden flex-shrink-0 flex items-center justify-center`}
    >
      <Image
        src="/logo-mark.png"
        alt="Signal Face"
        width={px * 2}
        height={px * 2}
        priority
        className="w-full h-full object-contain"
      />
    </div>
  );
};
