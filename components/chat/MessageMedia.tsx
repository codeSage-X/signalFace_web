'use client';

import { EyeOff } from 'lucide-react';
import type { ChatMediaUpload } from '@/lib/api';

export function MessageMedia({ media }: { media: ChatMediaUpload }) {
  if (media.moderationStatus !== 'approved') {
    return (
      <div className="w-56 max-w-full aspect-video bg-black/30 flex flex-col items-center justify-center gap-2 text-center p-4">
        <EyeOff size={24} />
        <p className="text-xs font-semibold">
          {media.moderationStatus === 'rejected'
            ? 'This content goes against community rules.'
            : 'This content is being moderated.'}
        </p>
      </div>
    );
  }

  if (media.type === 'video') {
    return <video src={media.url} controls playsInline preload="metadata" className="w-72 max-w-full max-h-80 bg-black object-contain" />;
  }

  return <img src={media.url} alt={media.name || 'Shared media'} className="w-72 max-w-full max-h-80 object-contain bg-black/20" />;
}
