import { useRouter } from 'expo-router';
import { AtSign, MapPin, Share2, Ticket } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import type { CouponItem } from '@/lib/mock/coupons-mock';
import { placePath } from '@/lib/consumer-route-contract';
import { toast } from '@/lib/toast';

export function CouponDetailActions({
  projectId,
  kind,
  status,
  muted,
}: {
  projectId: string;
  kind: CouponItem['kind'];
  status: CouponItem['status'];
  muted: boolean;
}) {
  const router = useRouter();
  const isInstagram = kind === 'instagram';

  return (
    <View className="gap-2">
      <Pressable
        onPress={() => router.push(placePath(projectId))}
        accessibilityRole="button"
        accessibilityLabel="View place"
        className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
            <MapPin color="#260409" size={16} />
          </View>
          <Text className="text-sm font-semibold text-foreground">
            View place
          </Text>
        </View>
        <Text className="text-[12px] text-muted-foreground">
          Details, map, menu
        </Text>
      </Pressable>

      {isInstagram && status === 'pending_story' ? (
        <Pressable
          onPress={() =>
            toast.action(
              'Story-tag auto-detection ships with the Meta Graph integration.',
              { label: 'Notify me', onClick: () => {} },
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Open Instagram and post story"
          className="flex-row items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 active:opacity-90"
        >
          <AtSign color="#ffffff" size={16} strokeWidth={2} />
          <Text className="text-sm font-semibold text-white">
            Open Instagram & post story
          </Text>
        </Pressable>
      ) : null}

      {!muted && kind === 'normal' && status === 'active' ? (
        <Pressable
          onPress={() =>
            toast.action(
              'QR redemption lands with the place scanner integration.',
              { label: 'Notify me', onClick: () => {} },
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Show at place"
          className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
        >
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Ticket color="#260409" size={16} />
            </View>
            <Text className="text-sm font-semibold text-foreground">
              Show at place
            </Text>
          </View>
          <Text className="text-[12px] text-muted-foreground">
            QR for the host
          </Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={() =>
          toast.action('Sharing a coupon link with a friend lands soon.', {
            label: 'Notify me',
            onClick: () => {},
          })
        }
        accessibilityRole="button"
        accessibilityLabel="Share with a friend"
        className="flex-row items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 active:bg-muted"
      >
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Share2 color="#260409" size={16} />
          </View>
          <Text className="text-sm font-semibold text-foreground">
            Share with a friend
          </Text>
        </View>
        <Text className="text-[12px] text-muted-foreground">
          They get a coupon too
        </Text>
      </Pressable>
    </View>
  );
}
