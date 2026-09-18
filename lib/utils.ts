import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const SIGNALFACE_COIN_USD = 1;

export function usdToSignalFaceCoins(value: string | number): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount / SIGNALFACE_COIN_USD : 0;
}

export function signalFaceCoinsToUsd(value: string | number): number {
  const coins = Number(value);
  return Number.isFinite(coins) ? coins * SIGNALFACE_COIN_USD : 0;
}

export function formatSignalFaceCoins(value: string | number): string {
  const coins = Number(value);
  const safeCoins = Number.isFinite(coins) ? coins : 0;
  const formatted = safeCoins.toLocaleString(undefined, {
    minimumFractionDigits: safeCoins % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 4,
  });
  return `${formatted} SC`;
}

export function formatUsd(value: string | number): string {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—';
}

/**
 * The app's public address, for links meant to be sent to other people.
 *
 * Not `window.location.origin`: on a developer machine that produces
 * http://localhost:3000, so an invite or share link copied during development
 * pointed somewhere only that machine can reach. Override per environment with
 * NEXT_PUBLIC_SITE_URL.
 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.signalface.com').replace(/\/$/, '');
}

/** A shareable invite link using the inviter's public username. */
export function inviteLink(username: string): string {
  return `${siteUrl()}/?ref=${encodeURIComponent(username)}`;
}

/**
 * A user-entered website turned into an absolute href.
 *
 * People type "www.example.com", and a browser reads a schemeless href as a path
 * relative to the current page — so that link resolved to
 * /app/www.example.com and 404'd instead of leaving the site. Anything without a
 * scheme gets https://.
 *
 * mailto: and tel: are passed through untouched, since they are already absolute
 * and must not be prefixed.
 */
export function externalHref(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  // Any scheme at all — http, https, mailto, tel — is already absolute.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;
  // Protocol-relative ("//example.com") is absolute too, just inheriting ours.
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return `https://${trimmed}`;
}

/** The same URL with the scheme and any trailing slash stripped, for display. */
export function displayUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}
