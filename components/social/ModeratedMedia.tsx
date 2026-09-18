import { EyeOff } from 'lucide-react';

export function ModeratedMedia({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#17141d] px-3 text-center ${className}`}
      aria-label="This content goes against our community rules"
    >
      <EyeOff size={24} strokeWidth={1.8} className="text-white/75" aria-hidden="true" />
      <p className="max-w-36 text-[11px] font-medium leading-4 text-white/75">
        This content goes against our community rules
      </p>
    </div>
  );
}
