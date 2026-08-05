import { Redirect, useLocalSearchParams } from 'expo-router';

import { reservationPath } from '@/lib/consumer-route-contract';

/** Legacy `/saved/reservation/[id]` → canonical `/reservation/[id]`. */
export default function LegacySavedReservationRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');
  if (!id) return <Redirect href="/(tabs)/reservations" />;
  return <Redirect href={reservationPath(id)} />;
}
