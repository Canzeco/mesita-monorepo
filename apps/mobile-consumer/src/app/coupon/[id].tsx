import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ticket } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { CouponDetailBody } from '@/components/coupon/CouponDetailBody';
import { CouponDetailModalShell } from '@/components/coupon/CouponDetailModalShell';
import { getMockCouponById } from '@/lib/mock/coupons-mock';

export default function CouponDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0] ?? '';
  const coupon = id ? getMockCouponById(id) : null;

  if (!coupon) {
    return (
      <CouponDetailModalShell placeName="Coupon">
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ticket color="#775254" size={28} />
          <Text className="font-display text-xl font-semibold text-foreground">
            Coupon not found
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
      </CouponDetailModalShell>
    );
  }

  return (
    <CouponDetailModalShell
      placeName={coupon.placeName}
      shareUrl={`https://consumer.mesita.ai/coupon/${coupon.id}`}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10"
        showsVerticalScrollIndicator={false}
      >
        <CouponDetailBody c={coupon} />
      </ScrollView>
    </CouponDetailModalShell>
  );
}
