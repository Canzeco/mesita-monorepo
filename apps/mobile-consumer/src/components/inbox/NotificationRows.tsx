import { Image } from 'expo-image';
import { Bell, MapPin, Star } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { COLORS } from '@/constants/brand';
import type { ConsumerNotification } from '@/lib/api/notifications';

function kindLabel(kind: string): string {
  if (kind === 'bill') return 'Your bill';
  if (kind === 'review') return 'Review update';
  return 'Update';
}

function KindIcon({ kind, size = 14 }: { kind: string; size?: number }) {
  if (kind === 'review') return <Star color={COLORS.mutedForeground} size={size} />;
  return <Bell color={COLORS.mutedForeground} size={size} />;
}

export function NotificationRow({ n }: { n: ConsumerNotification }) {
  const p = n.bill;

  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        overflow: 'hidden',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        padding: 12,
      }}
    >
      <View
        style={{
          height: 64,
          width: 64,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: COLORS.muted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {p.place_photo_url ? (
          <Image
            source={{ uri: p.place_photo_url }}
            style={{ height: 64, width: 64 }}
            contentFit="cover"
          />
        ) : (
          <MapPin color={COLORS.mutedForeground} size={20} style={{ opacity: 0.4 }} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={2}
          style={{
            fontSize: 14,
            lineHeight: 18,
            fontFamily: 'Inter_600SemiBold',
            color: COLORS.foreground,
          }}
        >
          {p.place_name ?? 'Mesita partner'}
        </Text>
        <View
          style={{
            marginTop: 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <KindIcon kind={n.kind} />
          <Text
            style={{
              fontSize: 12,
              color: COLORS.mutedForeground,
              fontFamily: 'Inter_400Regular',
            }}
          >
            {kindLabel(n.kind)}
          </Text>
        </View>
        {/* MVP cut (MESITA-2078): the "Reward MX$…" line is hidden while Pay
            is parked. */}
        <Text
          style={{
            marginTop: 4,
            fontSize: 10,
            color: COLORS.mutedForeground,
            fontFamily: 'Inter_400Regular',
          }}
        >
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
    <View
      style={{
        height: 88,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        opacity: 0.7,
      }}
    />
  );
}
