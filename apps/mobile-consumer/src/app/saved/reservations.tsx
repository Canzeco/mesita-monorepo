import { Redirect } from 'expo-router';

import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// Web `/saved/reservations` deep link → Expo parked-tab live page.
// Tab bar still opens ComingSoonModal on tap (PARKED.tabs.reservations).
export default function SavedReservationsRedirect() {
  return <Redirect href={CONSUMER_ROUTES.saved.reservations} />;
}
