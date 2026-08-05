import { Redirect } from 'expo-router';

import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// Legacy web `/saved/reservations` deep link → Expo Reservations tab.
export default function SavedReservationsRedirect() {
  return <Redirect href={CONSUMER_ROUTES.reservations} />;
}
