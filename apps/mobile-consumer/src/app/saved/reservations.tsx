import { Redirect } from 'expo-router';

import { inboxTabPath } from '@/lib/consumer-route-contract';

// Legacy web `/saved/reservations` deep link → Expo Reservations tab.
export default function SavedReservationsRedirect() {
  return <Redirect href={inboxTabPath()} />;
}
