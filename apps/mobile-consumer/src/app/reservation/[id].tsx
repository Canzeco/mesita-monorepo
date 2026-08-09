import { useLocalSearchParams, useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import { ReservationDetailBody } from '@/components/reservations/ReservationDetailBody';
import { ReservationDetailModalShell } from '@/components/reservations/ReservationDetailModalShell';
import { apiListReservations } from '@/lib/api/reservations';
import type { ReservationItem } from '@/lib/mock/reservations-mock';
import { toReservationItem } from '@/lib/reservations-adapter';

type State =
  | { status: 'loading' }
  | { status: 'found'; r: ReservationItem }
  | { status: 'missing' };

// consumer-web-list-reservations has no get-by-id, so the detail screen pulls
// the caller's full list once (scope "all") and finds the row. Web parity:
// apps/web-consumer/src/components/consumer/reservation-detail-fetch.tsx.
export default function ReservationDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : (params.id?.[0] ?? '');
  const [fetched, setFetched] = useState<State>({ status: 'loading' });
  const [reloadTick, setReloadTick] = useState(0);
  // An absent id can never resolve to a row, so it reads as missing without
  // ever entering the loading state.
  const state: State = id ? fetched : { status: 'missing' };

  useEffect(() => {
    // No id = nothing to fetch; the missing state is DERIVED below rather than
    // set here (setState in an effect body triggers cascading renders).
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const { reservations } = await apiListReservations({
          scope: 'all',
          limit: 200,
        });
        const match = reservations.find((row) => row.id === id);
        if (!cancelled) {
          setFetched(
            match
              ? { status: 'found', r: toReservationItem(match) }
              : { status: 'missing' },
          );
        }
      } catch {
        if (!cancelled) setFetched({ status: 'missing' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reloadTick]);

  if (state.status === 'loading') {
    return (
      <ReservationDetailModalShell placeName="Reservation">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#ec006c" />
        </View>
      </ReservationDetailModalShell>
    );
  }

  if (state.status === 'missing') {
    return (
      <ReservationDetailModalShell placeName="Reservation">
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Calendar color="#775254" size={28} />
          <Text className="font-display text-xl font-semibold text-foreground">
            Reservation not found
          </Text>
          <Pressable
            onPress={() => router.back()}
            className="mt-2 rounded-lg bg-foreground px-5 py-2.5"
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text className="text-sm font-semibold text-background">Go back</Text>
          </Pressable>
        </View>
      </ReservationDetailModalShell>
    );
  }

  return (
    <ReservationDetailModalShell
      placeName={state.r.placeName}
      shareUrl={`https://consumer.mesita.ai/reservation/${state.r.id}`}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <ReservationDetailBody
          r={state.r}
          onChanged={() => setReloadTick((n) => n + 1)}
        />
      </ScrollView>
    </ReservationDetailModalShell>
  );
}
