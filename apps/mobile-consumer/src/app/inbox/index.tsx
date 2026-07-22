import { Redirect } from 'expo-router';

import { inboxPath } from '@/lib/consumer-route-contract';

/** Default inbox landing — mirrors web `/inbox` → `/inbox/mine`. */
export default function InboxIndex() {
  return <Redirect href={inboxPath('mine')} />;
}
