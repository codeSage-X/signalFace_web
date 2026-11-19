'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { usersApi, ApiError, type LifeInterest } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { LifeInterestPicker } from './lifeInterests';

/**
 * First-visit picker for Life Connections. Saving (or skipping) stamps
 * `lifeInterestsSetAt` on the profile, so it never shows again; changes after
 * that happen in Settings.
 */
export function LifeInterestsOnboarding({ onDone }: { onDone: () => void }) {
  const { updateUser } = useAuth();
  const { addToast } = useToast();
  const [selected, setSelected] = useState<LifeInterest[]>([]);
  const [saving, setSaving] = useState(false);

  const save = async (interests: LifeInterest[]) => {
    setSaving(true);
    try {
      const res = await usersApi.updateLifeInterests(interests);
      updateUser({ lifeInterests: res.lifeInterests, lifeInterestsSetAt: res.lifeInterestsSetAt });
      onDone();
    } catch (err) {
      addToast({
        message: err instanceof ApiError ? err.message : 'Could not save your interests.',
        type: 'error',
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="life-interests-title"
        className="glass-card w-full max-w-lg rounded-2xl p-6 sm:p-7"
      >
        <h2 id="life-interests-title" className="text-xl font-bold text-foreground">
          What brings you to Life Connections?
        </h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Pick as many as you like. People can find you under each one, and you can change
          these anytime in Settings.
        </p>

        <LifeInterestPicker value={selected} onChange={setSelected} disabled={saving} />

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => save([])}
            disabled={saving}
            className="px-4 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition disabled:opacity-60"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={() => save(selected)}
            disabled={saving || selected.length === 0}
            className="px-5 py-2.5 rounded-xl brand-gradient text-white text-sm font-semibold hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
