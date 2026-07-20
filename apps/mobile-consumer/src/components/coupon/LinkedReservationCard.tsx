import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { LinkedReservationSummary } from '@/lib/mock/coupons-mock';
import { reservationPath } from '@/lib/consumer-route-contract';
import { guestNoun } from '@/lib/utils';

export function LinkedReservationCard({
  reservation,
}: {
  reservation: LinkedReservationSummary;
}) {
  const router = useRouter();
  const isBooking = reservation.state === 'booking';

  return (
    <Pressable
      onPress={() => router.push(reservationPath(reservation.id))}
      accessibilityRole="button"
      accessibilityLabel={`Reservation ${reservation.when}`}
      className="flex-row items-center gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3.5 active:opacity-90"
    >
      <View className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15">
        <Calendar color="#047857" size={20} strokeWidth={2} />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Reservation tied to this coupon
        </Text>
        <Text
          className="mt-0.5 text-[14px] font-semibold leading-tight text-foreground"
          numberOfLines={1}
        >
          {reservation.when}{' '}
          <Text className="font-normal text-muted-foreground">
            · {reservation.partySize} {guestNoun(reservation.partySize)}
          </Text>
        </Text>
      </View>
      <View
        className={`shrink-0 rounded-md border px-2 py-0.5 ${
          isBooking
            ? 'border-amber-500/30 bg-amber-50'
            : 'border-emerald-500/30 bg-emerald-50'
        }`}
      >
        <Text
          className={`text-[10px] font-semibold ${
            isBooking ? 'text-amber-800' : 'text-emerald-800'
          }`}
        >
          {isBooking ? 'Booking' : 'Booked'}
        </Text>
      </View>
    </Pressable>
  );
}
