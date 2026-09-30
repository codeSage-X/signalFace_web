/** Only Google's public profile-photo hosts and paths may use our image cache. */
export function googleAvatarUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const url = new URL(src);
    if (
      url.protocol !== 'https:' ||
      !/^lh[3-6]\.googleusercontent\.com$/.test(url.hostname) ||
      url.port || url.username || url.password ||
      !/^\/a-?\/[A-Za-z0-9_=-]+$/.test(url.pathname) ||
      url.search || url.hash
    ) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function avatarSource(src: string | null | undefined): string | null {
  if (!src) return null;
  const google = googleAvatarUrl(src);
  return google ? `/api/avatar/google?url=${encodeURIComponent(google)}` : src;
}
