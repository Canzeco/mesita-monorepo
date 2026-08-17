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
        if (!cancelled) setItems(orderOneFeed(reservations.map(toReservationItem), scope));
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

/**
 * Single-feed order (web parity): what's coming next, then what already
 * happened. Upcoming ascends — the soonest booking is the one you need —
 * and past descends, since the most recent visit is the one you'd look up.
 * Scoped modes keep the Edge Function's own order untouched.
 */
function orderOneFeed(
  rows: ReservationItem[],
  scope: ReservationScope,
): ReservationItem[] {
  if (scope !== 'all') return rows;
  const now = Date.now();
  const at = (r: ReservationItem) => {
    const t = new Date(r.reservedAt ?? '').getTime();
    return Number.isFinite(t) ? t : 0;
  };
  const upcoming: ReservationItem[] = [];
  const past: ReservationItem[] = [];
  for (const r of rows) (at(r) >= now ? upcoming : past).push(r);
  upcoming.sort((a, b) => at(a) - at(b));
  past.sort((a, b) => at(b) - at(a));
  return [...upcoming, ...past];
}
