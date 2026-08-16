import { Redirect } from 'expo-router';

import { inboxTabPath } from '@/lib/consumer-route-contract';

export default function InboxIndexScreen() {
  return <Redirect href={inboxTabPath()} />;
}
