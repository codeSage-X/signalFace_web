'use client';

import { useState } from 'react';
import { PAY_SMALL_SMALL } from './market-utils';

export const INSTALLMENT_COUNTS = Array.from({ length: 11 }, (_, index) => index + 2);

// Uncontrolled seller fields for Pay small small; read them back with installmentSettings().
export function InstallmentFields({ maxCount, depositPercent }: { maxCount?: number | null; depositPercent?: number | null }) {
  const [enabled, setEnabled] = useState(!!maxCount);
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <label className="flex items-center gap-3 text-sm font-semibold"><input name="installmentEnabled" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="h-4 w-4 accent-primary" />Offer {PAY_SMALL_SMALL}</label>
      {enabled && <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold">Up to<select name="installmentMaxCount" defaultValue={maxCount ?? 6} className="glass-input mt-2 w-full rounded-lg p-3 font-normal">{INSTALLMENT_COUNTS.map((count) => <option key={count} value={count}>{count} payments</option>)}</select></label>
        <label className="text-sm font-semibold">Minimum deposit (%)<input name="installmentDepositPercent" type="number" min={0} max={90} step={1} required defaultValue={depositPercent ?? 20} className="glass-input mt-2 w-full rounded-lg p-3 font-normal" /></label>
      </div>}
      <p className="text-xs text-muted-foreground">Buyers reserve the item and pay you weekly or monthly, then collect it once fully paid. You record each payment you receive.</p>
    </div>
  );
}

export function installmentSettings(form: FormData) {
  return form.get('installmentEnabled') === 'on'
    ? { installmentMaxCount: Number(form.get('installmentMaxCount')), installmentDepositPercent: Number(form.get('installmentDepositPercent')) }
    : { installmentMaxCount: null };
}
