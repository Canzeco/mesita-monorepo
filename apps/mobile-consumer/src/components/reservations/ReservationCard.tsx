import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { reservationPath } from '@/lib/consumer-route-contract';
import type {
  ReservationItem,
  ReservationStatus,
} from '@/lib/mock/reservations-mock';
import { guestNoun } from '@/lib/utils';

// Reservation list card — booking metadata only. A reservation carries no
// money at all: the reward comes from showing up, and the rates live on the
// visit ticket that snapshots them.
// Web parity: apps/web-consumer/src/components/consumer/ReservationCard.tsx.

const STATUS_META: Record<
  ReservationStatus,
  { label: string; Icon: LucideIcon; pill: string; text: string; icon: string }
> = {
  booking: {
    label: 'Booking',
    Icon: Clock,
    pill: 'border-amber-500/30 bg-amber-50',
    text: 'text-amber-800',
    icon: '#d97706',
  },
  booked: {
    label: 'Booked',
    Icon: CheckCircle2,
    pill: 'border-emerald-500/30 bg-emerald-50',
    text: 'text-emerald-800',
    icon: '#059669',
  },
  cancelled: {
    label: 'Cancelled',
    Icon: X,
    pill: 'border-border bg-muted',
    text: 'text-muted-foreground',
    icon: '#775254',
  },
};

export function ReservationCard({ r }: { r: ReservationItem }) {
  const router = useRouter();
  const meta = STATUS_META[r.status];
  const cancelled = r.status === 'cancelled';

  return (
    <Pressable
      onPress={() => router.push(reservationPath(r.id))}
      accessibilityRole="button"
      accessibilityLabel={`Open reservation at ${r.placeName}`}
      className={`rounded-2xl border border-border bg-card p-3 active:opacity-90 ${
        cancelled ? 'opacity-70' : ''
      }`}
    >
      <View className="flex-row items-start gap-3">
        <View className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">
          {r.placePhoto ? (
            <Image
              source={{ uri: r.placePhoto }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Calendar color="#775254" size={20} />
            </View>
          )}
        </View>

        <View className="min-w-0 flex-1">
          <View className="flex-row items-start justify-between gap-2">
            <Text
              className={`flex-1 font-display text-base font-semibold leading-tight text-foreground ${
                cancelled ? 'line-through' : ''
              }`}
              numberOfLines={1}
            >
              {r.placeName}
            </Text>
            <View
              className={`shrink-0 flex-row items-center gap-1 rounded-md border px-2 py-0.5 ${meta.pill}`}
            >
              <meta.Icon color={meta.icon} size={12} strokeWidth={2.25} />
              <Text className={`text-[10px] font-semibold ${meta.text}`}>
                {meta.label}
              </Text>
            </View>
          </View>

          <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
            <View className="flex-row items-center gap-1">
              <Calendar color="#775254" size={12} />
              <Text className="text-[12px] text-muted-foreground">{r.when}</Text>
            </View>
            <Text className="text-[12px] text-muted-foreground/60">·</Text>
            <View className="flex-row items-center gap-1">
              <Users color="#775254" size={12} />
              <Text className="text-[12px] text-muted-foreground">
                {r.partySize} {guestNoun(r.partySize)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {r.statusNote ? (
        <View
          className={`mt-3 rounded-xl px-3 py-2 ${
            r.status === 'booking' ? 'bg-amber-50' : 'bg-muted'
          }`}
        >
          <Text
            className={`text-[12px] leading-snug ${
              r.status === 'booking' ? 'text-amber-900' : 'text-muted-foreground'
            }`}
          >
            {r.statusNote}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
