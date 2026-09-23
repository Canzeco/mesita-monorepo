import { Redirect } from 'expo-router';

import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// Legacy `/notifications` → Me › Notifications, web's one-hop destination.
export default function NotificationsRedirect() {
  return <Redirect href={CONSUMER_ROUTES.mePages.notifications} />;
}
