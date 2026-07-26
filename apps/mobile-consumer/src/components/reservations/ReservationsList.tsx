import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { ReservationCard } from '@/components/reservations/ReservationCard';
import {
  apiListReservations,
  type ReservationScope,
} from '@/lib/api/reservations';
import type { ReservationItem } from '@/lib/mock/reservations-mock';
import { toReservationItem } from '@/lib/reservations-adapter';
import { errMsg } from '@/lib/utils';

// Live reservations list for the Reservations tab. Reads
// consumer-web-list-reservations for the scope and renders ReservationCard
// rows, falling back to the provided empty state. Web parity:
// apps/web-consumer/src/components/consumer/reservations-list.tsx.
export function ReservationsList({
  scope,
  empty,
}: {
  scope: ReservationScope;
  empty: ReactNode;
}) {
  const [items, setItems] = useState<ReservationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reservations } = await apiListReservations({ scope });
        if (!cancelled) setItems(reservations.map(toReservationItem));
      } catch (e) {
        if (!cancelled) setError(errMsg(e, "Couldn't load your reservations."));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  if (error) {
    return (
      <View className="px-4 pt-4">
        <View className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
          <Text className="text-[13px] font-medium text-red-600">{error}</Text>
        </View>
      </View>
    );
  }
  if (items === null) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#ec006c" />
      </View>
    );
  }
  if (items.length === 0) return <>{empty}</>;

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16, gap: 12 }}
      showsVerticalScrollIndicator={false}
    >
      {items.map((r) => (
        <ReservationCard key={r.id} r={r} />
      ))}
    </ScrollView>
  );
}
