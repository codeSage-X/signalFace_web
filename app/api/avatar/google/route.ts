import { googleAvatarUrl } from '@/lib/avatar-source';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const failure = (status: number) => new Response(null, {
  status,
  headers: { 'Cache-Control': 'no-store' },
});

// Cache public Google profile photos on our own origin. This prevents each
// avatar on a page from requesting Google directly, and keeps browser referrers
// and third-party image restrictions out of the profile-picture request.
export async function GET(request: Request) {
  const url = googleAvatarUrl(new URL(request.url).searchParams.get('url'));
  if (!url) return failure(400);

  try {
    const upstream = await fetch(url, {
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: 86_400 },
    });
    if (!upstream.ok) return failure(502);
    const contentType = upstream.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
    if (!contentType || !/^image\/(jpeg|png|webp|gif|avif)$/.test(contentType)) return failure(502);
    if (Number(upstream.headers.get('content-length')) > MAX_IMAGE_BYTES) return failure(502);
    const body = await upstream.arrayBuffer();
    if (!body.byteLength || body.byteLength > MAX_IMAGE_BYTES) return failure(502);
    return new Response(body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return failure(502);
  }
}
