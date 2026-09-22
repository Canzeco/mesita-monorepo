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

import { COLORS } from '@/constants/brand';
import { reservationPath } from '@/lib/consumer-route-contract';
import type {
  ReservationItem,
  ReservationState,
} from '@/lib/mock/reservations-mock';
import { guestNoun } from '@/lib/utils';

// Reservation list card — booking metadata only. A reservation carries no
// money at all: the reward comes from showing up, and the rates live on the
// visit ticket that snapshots them.
// Web parity: apps/web-consumer/src/components/consumer/ReservationCard.tsx.

// Achromatic (MESITA-1954). Amber "Booking" and emerald "Booked" greyscale to
// the SAME pill as "Cancelled" — L97 fills, L~57 icons — so the three phases
// are re-separated by RANK, not by three greys nobody can tell apart at 10px:
// filled ink = the table is yours · dashed outline = waiting on the place ·
// flat muted + dimmed label = spent. The glyph (CheckCircle2 / Clock / X) and
// the `opacity-70` + `line-through` on a cancelled card carry the rest.
const STATE_META: Record<
  ReservationState,
  { label: string; Icon: LucideIcon; pill: string; text: string; icon: string }
> = {
  booking: {
    label: 'Booking',
    Icon: Clock,
    pill: 'border-dashed border-foreground bg-card',
    text: 'text-foreground',
    icon: COLORS.foreground,
  },
  booked: {
    label: 'Booked',
    Icon: CheckCircle2,
    pill: 'border-primary bg-primary',
    text: 'text-primary-foreground',
    icon: COLORS.primaryForeground,
  },
  cancelled: {
    label: 'Cancelled',
    Icon: X,
    pill: 'border-border bg-muted',
    text: 'text-muted-foreground',
    icon: COLORS.mutedForeground,
  },
};

export function ReservationCard({ r }: { r: ReservationItem }) {
  const router = useRouter();
  const meta = STATE_META[r.state];
  const cancelled = r.state === 'cancelled';

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
              <Calendar color={COLORS.mutedForeground} size={20} />
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
              <Calendar color={COLORS.mutedForeground} size={12} />
              <Text className="text-[12px] text-muted-foreground">{r.when}</Text>
            </View>
            <Text className="text-[12px] text-muted-foreground/60">·</Text>
            <View className="flex-row items-center gap-1">
              <Users color={COLORS.mutedForeground} size={12} />
              <Text className="text-[12px] text-muted-foreground">
                {r.partySize} {guestNoun(r.partySize)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {r.stateNote ? (
        <View
          className={`mt-3 rounded-xl px-3 py-2 ${
            r.state === 'booking'
              ? 'border border-dashed border-foreground bg-muted'
              : 'bg-muted'
          }`}
        >
          <Text
            className={`text-[12px] leading-snug ${
              r.state === 'booking' ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {r.stateNote}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
