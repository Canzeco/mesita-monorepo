import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Info, Percent, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { PREMIUM_SUBSCRIBE_URL } from '@/lib/consumer-classes';
import { useAuth } from '@/providers/auth';

const ORIGIN_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  subscription: 'Subscription',
  invitation: 'Invite',
};

// Two top cards above the passport — web RewardsTopCards port (MESITA-580).
// decision: Unlock Premium opens consumer.mesita.ai/me (no Stripe in binary).
export function RewardsTopCards() {
  const { consumerClass } = useAuth();
  const insets = useSafeAreaInsets();
  const isPremium = consumerClass?.class === 'premium';
  const origin = consumerClass?.origin ?? 'default';
  const [howOpen, setHowOpen] = useState(false);

  return (
    <>
      <View className="flex-row items-stretch gap-2.5">
        <Pressable
          onPress={() => {
            if (isPremium) return;
            void Linking.openURL(PREMIUM_SUBSCRIBE_URL);
          }}
          accessibilityRole="button"
          accessibilityLabel={
            isPremium ? 'Premium active' : 'Subscribe on web'
          }
          className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-border bg-card p-3 active:opacity-95"
        >
          <LinearGradient
            colors={[...GRADIENTS.premium]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isPremium ? (
              <Crown color="#fff" size={18} fill="#fff" />
            ) : (
              <Sparkles color="#fff" size={18} />
            )}
          </LinearGradient>
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="font-bold text-foreground"
              style={{ fontSize: 13 }}
            >
              {isPremium ? 'Premium active' : 'Unlock Premium'}
            </Text>
            <Text
              numberOfLines={1}
              className="text-muted-foreground"
              style={{ fontSize: 11 }}
            >
              {isPremium
                ? `via ${ORIGIN_LABEL[origin] ?? 'Mesita'}`
                : 'Subscribe on web'}
            </Text>
          </View>
        </Pressable>

        <Pressable
          onPress={() => setHowOpen(true)}
          accessibilityRole="button"
          className="flex-1 flex-row items-center gap-2.5 rounded-2xl border border-border bg-card p-3 active:opacity-95"
        >
          <LinearGradient
            colors={['#ff7a45', '#ff2d78']}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Percent color="#fff" size={18} strokeWidth={2.5} />
          </LinearGradient>
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="font-bold text-foreground"
              style={{ fontSize: 13 }}
            >
              How it works
            </Text>
            <Text
              numberOfLines={1}
              className="text-muted-foreground"
              style={{ fontSize: 11 }}
            >
              Instant off the bill
            </Text>
          </View>
        </Pressable>
      </View>

      <Modal
        visible={howOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setHowOpen(false)}
      >
        <Pressable
          className="flex-1 bg-foreground/40"
          onPress={() => setHowOpen(false)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View
          className="gap-4 rounded-t-3xl bg-background px-5 pt-4"
          style={{ paddingBottom: Math.max(insets.bottom, 24) + 8 }}
        >
          <View className="flex-row items-center gap-2.5">
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Info color="#fb2b7b" size={18} />
            </View>
            <Text
              className="font-bold tracking-tight text-foreground"
              style={{ fontSize: 18 }}
            >
              How rewards work
            </Text>
          </View>

          <View className="flex-row items-start gap-3">
            <View className="h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10">
              <Percent color="#cf0360" size={18} strokeWidth={2.25} />
            </View>
            <Text
              className="flex-1 text-muted-foreground"
              style={{ fontSize: 13, lineHeight: 20 }}
            >
              <Text className="font-semibold text-foreground">
                Instant discounts.{' '}
              </Text>
              Show your QR or code at the check — it comes straight off the
              bill. Mesita never holds your money.
            </Text>
          </View>

          <View className="flex-row items-start gap-3">
            <LinearGradient
              colors={[...GRADIENTS.premium]}
              start={GRADIENT_DIAGONAL.start}
              end={GRADIENT_DIAGONAL.end}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Crown color="#fff" size={18} fill="#fff" />
            </LinearGradient>
            <Text
              className="flex-1 text-muted-foreground"
              style={{ fontSize: 13, lineHeight: 20 }}
            >
              <Text className="font-semibold text-foreground">
                Premium boosts them.{' '}
              </Text>
              Free gets the base discount; Premium unlocks bigger ones — free
              with Instagram.
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}
