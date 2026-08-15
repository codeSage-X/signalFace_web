import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
