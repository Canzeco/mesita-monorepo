import { useRouter } from 'expo-router';
import { AtSign, Gift, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { LinkedCouponSummary } from '@/lib/mock/reservations-mock';
import { couponPath } from '@/lib/consumer-route-contract';

export function MetaRow({
  Icon,
  iconColor = '#775254',
  label,
  value,
}: {
  Icon: LucideIcon;
  iconColor?: string;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Icon color={iconColor} size={16} strokeWidth={2} />
      <Text className="flex-1 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="text-sm font-semibold text-foreground">{value}</Text>
    </View>
  );
}

export function LinkedCouponCard({ coupon }: { coupon: LinkedCouponSummary }) {
  const router = useRouter();
  const ig = coupon.kind === 'instagram';

  return (
    <Pressable
      onPress={() => router.push(couponPath(coupon.id))}
      accessibilityRole="button"
      accessibilityLabel={`${coupon.percent}% reward coupon`}
      className="flex-row items-center gap-3 rounded-2xl border border-pink-500/15 bg-pink-500/5 px-4 py-3.5 active:opacity-90"
    >
      <View className="h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-pink-500/15">
        {ig ? (
          <AtSign color="#db2777" size={20} strokeWidth={2} />
        ) : (
          <Gift color="#db2777" size={20} strokeWidth={2} />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Reward tied to this reservation
        </Text>
        <Text className="mt-0.5 text-[14px] font-semibold leading-tight text-foreground">
          <Text className="text-primary">{coupon.percent}%</Text> discount{' '}
          <Text className="font-normal text-muted-foreground">
            · {coupon.classLabel}
          </Text>
        </Text>
      </View>
      <View
        className={`shrink-0 rounded-md border px-2 py-0.5 ${
          coupon.state === 'active'
            ? 'border-emerald-500/30 bg-emerald-50'
            : 'border-amber-500/30 bg-amber-50'
        }`}
      >
        <Text
          className={`text-[10px] font-semibold ${
            coupon.state === 'active' ? 'text-emerald-800' : 'text-amber-800'
          }`}
        >
          {coupon.state === 'active' ? 'Active' : 'Pending'}
        </Text>
      </View>
    </Pressable>
  );
}
