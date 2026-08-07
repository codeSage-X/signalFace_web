// components/social/CommentSheet.tsx
'use client';

import { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faPaperPlane, faHeart } from '@fortawesome/free-solid-svg-icons';
import { Comment } from '@/lib/types/post';

interface CommentSheetProps {
  postId: string;
  initialComments: Comment[];
  onClose: () => void;
}

export function CommentSheet({ initialComments, onClose }: CommentSheetProps) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [draft, setDraft] = useState('');

  const handleSend = () => {
    if (!draft.trim()) return;
    const newComment: Comment = {
      id: `local-${Date.now()}`,
      author: 'you',
      avatar: '🙂',
      text: draft.trim(),
      timestamp: 'now',
      likes: 0,
    };
    setComments(prev => [newComment, ...prev]);
    setDraft('');
  };

  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md glass-card rounded-t-2xl max-h-[70%] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-semibold text-card-foreground text-sm">{comments.length} comments</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {comments.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">No comments yet. Be the first.</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <div className="text-xl">{c.avatar}</div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-card-foreground">{c.author}</p>
                <p className="text-sm text-card-foreground/90">{c.text}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-muted-foreground">{c.timestamp}</span>
                  <button className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1">
                    <FontAwesomeIcon icon={faHeart} className="h-3 w-3" />
                    {c.likes}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Add a comment..."
            className="flex-1 glass-input rounded-full px-4 py-2 text-sm text-foreground"
          />
          <button
            onClick={handleSend}
            className="h-9 w-9 flex items-center justify-center rounded-full brand-gradient text-primary-foreground disabled:opacity-40"
            disabled={!draft.trim()}
          >
            <FontAwesomeIcon icon={faPaperPlane} className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}