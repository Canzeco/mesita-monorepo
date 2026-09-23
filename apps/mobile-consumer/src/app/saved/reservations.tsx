import { Redirect } from 'expo-router';

import { CONSUMER_ROUTES } from '@/lib/consumer-route-contract';

// Legacy web `/saved/reservations` deep link → Me › Reservations, web's
// one-hop destination for the same address.
export default function SavedReservationsRedirect() {
  return <Redirect href={CONSUMER_ROUTES.mePages.reservations} />;
}
