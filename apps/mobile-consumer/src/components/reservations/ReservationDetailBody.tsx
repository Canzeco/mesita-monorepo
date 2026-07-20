import {
  Calendar,
  CheckCircle2,
  Clock,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { Image, Text, View } from 'react-native';

import { ReservationActions } from '@/components/reservations/reservation-actions';
import {
  LinkedCouponCard,
  MetaRow,
} from '@/components/reservations/reservation-detail-ui';
import type {
  ReservationItem,
  ReservationStatus,
} from '@/lib/mock/reservations-mock';
import { guestNoun } from '@/lib/utils';

const STATUS_META: Record<
  ReservationStatus,
  {
    label: string;
    pillClass: string;
    textClass: string;
    Icon: LucideIcon;
    iconColor: string;
    banner: string | null;
  }
> = {
  booking: {
    label: 'Booking',
    pillClass: 'border-amber-500/30 bg-amber-50',
    textClass: 'text-amber-800',
    Icon: Clock,
    iconColor: '#d97706',
    banner:
      "We're booking this for you — you'll get a confirmation as soon as the place replies.",
  },
  booked: {
    label: 'Booked',
    pillClass: 'border-emerald-500/30 bg-emerald-50',
    textClass: 'text-emerald-800',
    Icon: CheckCircle2,
    iconColor: '#059669',
    banner: null,
  },
  cancelled: {
    label: 'Cancelled',
    pillClass: 'border-border bg-muted',
    textClass: 'text-muted-foreground',
    Icon: X,
    iconColor: '#775254',
    banner:
      'This reservation is cancelled. Saved rewards remain valid for a new booking.',
  },
};

export function ReservationDetailBody({ r }: { r: ReservationItem }) {
  const meta = STATUS_META[r.status];
  const cancelled = r.status === 'cancelled';

  return (
    <View className="gap-4 px-4 pb-8 pt-4">
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <View className="aspect-[16/9] w-full bg-muted">
          {r.placePhoto ? (
            <Image
              source={{ uri: r.placePhoto }}
              className="h-full w-full"
              style={cancelled ? { opacity: 0.8 } : undefined}
              accessibilityLabel={r.placeName}
            />
          ) : null}
        </View>
        <View className="flex-row items-start justify-between gap-2 px-4 py-3">
          <Text
            className={`min-w-0 flex-1 font-display text-xl font-semibold leading-tight tracking-tight text-foreground ${
              cancelled ? 'line-through' : ''
            }`}
          >
            {r.placeName}
          </Text>
          <View
            className={`shrink-0 flex-row items-center gap-1 rounded-md border px-2.5 py-0.5 ${meta.pillClass}`}
          >
            <meta.Icon color={meta.iconColor} size={12} strokeWidth={2.25} />
            <Text className={`text-[11px] font-semibold ${meta.textClass}`}>
              {meta.label}
            </Text>
          </View>
        </View>
      </View>

      {meta.banner ? (
        <View
          className={`rounded-2xl px-3 py-2.5 ${
            r.status === 'booking'
              ? 'bg-amber-50 ring-1 ring-amber-400/30'
              : 'bg-muted'
          }`}
        >
          <Text
            className={`text-[12.5px] leading-snug ${
              r.status === 'booking' ? 'text-amber-900' : 'text-muted-foreground'
            }`}
          >
            {r.statusNote ?? meta.banner}
          </Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <MetaRow Icon={Calendar} label="When" value={r.when} />
        <View className="h-px bg-border/70" />
        <MetaRow
          Icon={Users}
          label="Party"
          value={`${r.partySize} ${guestNoun(r.partySize)}`}
        />
        <View className="h-px bg-border/70" />
        <MetaRow
          Icon={meta.Icon}
          iconColor={meta.iconColor}
          label="Status"
          value={meta.label}
        />
      </View>

      {r.linkedCoupon && !cancelled ? (
        <LinkedCouponCard coupon={r.linkedCoupon} />
      ) : null}

      <ReservationActions projectId={r.projectId} cancelled={cancelled} />
    </View>
  );
}
