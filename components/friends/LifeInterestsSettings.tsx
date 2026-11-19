'use client';

import { useEffect, useState } from 'react';
import { HeartHandshake, Loader2 } from 'lucide-react';
import { usersApi, ApiError, type LifeInterest } from '@/lib/api';
import { useAuth, useToast } from '@/lib/stores';
import { LifeInterestPicker } from './lifeInterests';

/** Settings card for editing Life Connections interests after onboarding. */
export function LifeInterestsSettings() {
  const { user, isAuthenticated, updateUser } = useAuth();
  const { addToast } = useToast();
  const saved = (user?.lifeInterests ?? []) as LifeInterest[];
  const [value, setValue] = useState<LifeInterest[]>(saved);
  const [saving, setSaving] = useState(false);

  // The stored session may predate this field, so read the live profile once.
  useEffect(() => {
    if (!isAuthenticated) return;
    usersApi
      .getMe()
      .then((me) =>
        updateUser({
          lifeInterests: me.lifeInterests ?? [],
          lifeInterestsSetAt: me.lifeInterestsSetAt ?? null,
        }),
      )
      .catch(() => {});
  }, [isAuthenticated, updateUser]);

  useEffect(() => {
    setValue(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.join(',')]);

  const dirty = [...value].sort().join(',') !== [...saved].sort().join(',');

  const save = async () => {
    setSaving(true);
    try {
      const res = await usersApi.updateLifeInterests(value);
      updateUser({ lifeInterests: res.lifeInterests, lifeInterestsSetAt: res.lifeInterestsSetAt });
      addToast({ message: 'Life Connections interests updated.', type: 'success', duration: 3000 });
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
    <div className="glass-card rounded-2xl p-6">
      <h2 className="text-lg font-bold text-foreground mb-2 flex items-center gap-2">
        <HeartHandshake size={20} />
        Life Connections
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        What you&apos;re open to meeting people for. Others find you under each one you pick in
        Meet People.
      </p>

      <LifeInterestPicker value={value} onChange={setValue} disabled={saving} />

      {dirty && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white brand-gradient hover:brightness-110 transition disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
          <button
            onClick={() => setValue(saved)}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium glass-chip text-foreground hover:brightness-125 transition disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
