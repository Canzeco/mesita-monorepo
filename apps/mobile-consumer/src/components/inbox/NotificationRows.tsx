import { Image } from 'expo-image';
import { Bell, MapPin, Star } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { ConsumerNotification } from '@/lib/api/notifications';
import { formatPayMx } from '@/lib/api/pay';

function kindLabel(kind: string): string {
  if (kind === 'bill') return 'Your bill';
  if (kind === 'review') return 'Review update';
  return 'Update';
}

function KindIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  if (kind === 'review') return <Star color="#775254" size={size} />;
  return <Bell color="#775254" size={size} />;
}

export function NotificationRow({ n }: { n: ConsumerNotification }) {
  const p = n.bill;
  const reward =
    p.total_reward_cents ?? (p.discount_cents ?? 0) + (p.redeem_cents ?? 0);

  return (
    <View className="flex-row gap-3 overflow-hidden rounded-2xl border border-border bg-card p-3">
      <View className="h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-muted">
        {p.place_photo_url ? (
          <Image
            source={{ uri: p.place_photo_url }}
            style={{ height: 64, width: 64 }}
            contentFit="cover"
          />
        ) : (
          <MapPin color="#775254" size={20} style={{ opacity: 0.4 }} />
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text
          numberOfLines={2}
          className="text-sm font-semibold leading-[18px] text-foreground"
        >
          {p.place_name ?? 'Mesita partner'}
        </Text>
        <View className="mt-0.5 flex-row items-center gap-1.5">
          <KindIcon kind={n.kind} />
          <Text className="text-xs text-muted-foreground">
            {kindLabel(n.kind)}
          </Text>
        </View>
        {reward > 0 ? (
          <Text className="mt-1 text-xs font-medium text-sky-600">
            Reward {formatPayMx(reward, p.currency)}
          </Text>
        ) : null}
        <Text className="mt-1 text-[10px] text-muted-foreground">
          {new Date(n.created_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

export function SkeletonRow() {
  return (
    <View className="h-[88px] rounded-2xl border border-border bg-card opacity-70" />
  );
}
