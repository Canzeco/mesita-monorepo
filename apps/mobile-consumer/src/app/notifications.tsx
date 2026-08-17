import { Redirect } from 'expo-router';

import { inboxTabPath } from '@/lib/consumer-route-contract';

/** Legacy web `/notifications` → inbox mine (parity). */
export default function NotificationsRedirect() {
  return <Redirect href={inboxTabPath()} />;
}
