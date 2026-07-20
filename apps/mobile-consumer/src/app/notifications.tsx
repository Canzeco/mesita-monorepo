import { Redirect } from 'expo-router';

import { inboxPath } from '@/lib/consumer-route-contract';

/** Legacy web `/notifications` → inbox mine (parity). */
export default function NotificationsRedirect() {
  return <Redirect href={inboxPath('mine')} />;
}
