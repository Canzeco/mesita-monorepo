import { Redirect } from 'expo-router';

import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// Bare `/inbox` → Me. Activity is not a tab or a container on either platform
// (web MESITA-1626; mobile's tab went at MESITA-2050); its sections are Me
// pages, and web's redirect table sends this address to /me.
export default function InboxIndexRedirect() {
  return <Redirect href={CONSUMER_ROUTES.me} />;
}
