import { redirect } from 'next/navigation';

// Invite links point here (`/?ref=<username>`), so the query string must survive
// the redirect: the sign-up modal reads `ref` from the URL it lands on.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value ? [value] : []) query.append(key, item);
  }
  const qs = query.toString();
  redirect(qs ? `/app/for-you?${qs}` : '/app/for-you');
}
