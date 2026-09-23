import { Redirect, useLocalSearchParams } from 'expo-router';

import {
  CONSUMER_ROUTES,
  reservationPath,
} from '@/lib/consumer-route-contract';

/** Legacy `/saved/reservation/[id]` → canonical `/reservation/[id]`. */
export default function LegacySavedReservationRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');
  if (!id) return <Redirect href={CONSUMER_ROUTES.mePages.reservations} />;
  return <Redirect href={reservationPath(id)} />;
}
