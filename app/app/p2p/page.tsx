import { redirect } from 'next/navigation';

export default function P2PRedirectPage() {
  redirect('/app/market?tab=p2p');
}
