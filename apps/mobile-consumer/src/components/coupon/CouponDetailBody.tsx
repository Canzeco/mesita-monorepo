import { Calendar, Sparkles, Ticket } from 'lucide-react-native';
import { Image, Text, View } from 'react-native';

import { CouponDetailActions } from '@/components/coupon/coupon-detail-actions';
import { MetaRow, StatusBanner } from '@/components/coupon/coupon-detail-ui';
import { IG_STATUS, NORMAL_STATUS } from '@/components/coupon/coupon-status';
import { LinkedReservationCard } from '@/components/coupon/LinkedReservationCard';
import type {
  CouponItem,
  InstagramCouponStatus,
  NormalCouponStatus,
} from '@/lib/mock/coupons-mock';

export function CouponDetailBody({ c }: { c: CouponItem }) {
  const isInstagram = c.kind === 'instagram';
  const meta = isInstagram
    ? IG_STATUS[c.status as InstagramCouponStatus]
    : NORMAL_STATUS[c.status as NormalCouponStatus];
  const muted =
    c.status === 'expired' ||
    c.status === 'redeemed' ||
    (c.kind === 'normal' && c.status === 'cancelled');

  return (
    <View className="gap-4 px-4 pb-8 pt-4">
      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <View className="aspect-[16/9] w-full bg-muted">
          {c.placePhoto ? (
            <Image
              source={{ uri: c.placePhoto }}
              className="h-full w-full"
              style={muted ? { opacity: 0.8 } : undefined}
              accessibilityLabel={c.placeName}
            />
          ) : null}
        </View>
        <View className="flex-row items-start gap-3 px-4 py-3">
          <View className="min-w-0 flex-1">
            <Text className="font-display text-xl font-semibold leading-tight tracking-tight text-foreground">
              {c.placeName}
            </Text>
            <Text className="mt-0.5 text-[12px] text-muted-foreground">
              {c.classLabel}
            </Text>
          </View>
          <View className="items-end">
            <Text className="font-display text-3xl font-semibold leading-none text-foreground">
              {c.percent}
              <Text className="text-lg text-foreground/70">%</Text>
            </Text>
            <Text className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              reward
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap items-center justify-between gap-2 border-t border-border/70 px-4 py-3">
          <View
            className={`flex-row items-center gap-1 rounded-md border px-2 py-0.5 ${meta.pillClass}`}
          >
            <meta.Icon color={meta.iconColor} size={12} strokeWidth={2.25} />
            <Text className={`text-[11px] font-semibold ${meta.iconClass}`}>
              {meta.label}
            </Text>
          </View>
          {isInstagram ? (
            <View className="flex-row items-center gap-1">
              <Sparkles color="#775254" size={12} />
              <Text className="text-[10.5px] text-muted-foreground">
                Story coupon
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {meta.banner ? <StatusBanner banner={meta.banner} /> : null}

      {c.kind === 'instagram' && c.status === 'rejected' && c.rejectReason ? (
        <View className="rounded-2xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
          <Text className="text-[12.5px] leading-snug text-destructive">
            {c.rejectReason}
          </Text>
        </View>
      ) : null}

      <View className="overflow-hidden rounded-2xl border border-border bg-card">
        <MetaRow Icon={Ticket} label="Class" value={c.classLabel} />
        <View className="h-px bg-border/70" />
        <MetaRow Icon={Sparkles} label="Cap" value={c.capLabel} />
        <View className="h-px bg-border/70" />
        <MetaRow
          Icon={Calendar}
          label="Expires"
          value={c.expiresAt ?? 'No expiry'}
        />
      </View>

      {c.linkedReservation && !muted ? (
        <LinkedReservationCard reservation={c.linkedReservation} />
      ) : null}

      <CouponDetailActions
        projectId={c.projectId}
        kind={c.kind}
        status={c.status}
        muted={muted}
      />
    </View>
  );
}
