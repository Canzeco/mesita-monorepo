// The wallet's context strip (MESITA-808, 1A) — mobile mirror. FLAT by
// design: the only gradient on this page belongs to the live ticket / Start
// hero. Premium door links out to web (no payment UI in this app). The
// education door moved to Me > Help (MESITA-809) — three items on the row
// means the ceiling line stops truncating.

import { Crown } from 'lucide-react-native';
import { Linking, Pressable, Text, View } from 'react-native';

import {
  PREMIUM_SUBSCRIBE_URL,
  classProperLabel,
  isElevatedClass,
} from '@/lib/consumer-classes';
import { peakRateForClass, type RewardClassKey } from '@/lib/reward-segments';
import { useAuth } from '@/providers/auth';

export function ContextStrip() {
  const { consumerClass } = useAuth();
  const key = (consumerClass?.class ?? 'standard') as RewardClassKey;
  const isElevated = isElevatedClass(key);
  const peak = peakRateForClass(key);

  return (
    <View
      className="flex-row items-center gap-2.5 rounded-2xl border border-border bg-card px-3.5"
      style={{ minHeight: 44, paddingVertical: 10 }}
    >
      <View
        className={`rounded-full px-2 py-0.5 ${
          isElevated ? 'bg-premium/10' : 'bg-primary/10'
        }`}
      >
        <Text
          className={`font-extrabold uppercase ${
            isElevated ? 'text-premium' : 'text-primary'
          }`}
          style={{ fontSize: 10, letterSpacing: 1.2 }}
        >
          {classProperLabel(key)}
        </Text>
      </View>
      <Text
        className="min-w-0 flex-1 font-semibold text-foreground"
        numberOfLines={1}
        style={{ fontSize: 12.5 }}
      >
        Up to {peak}% off for you
      </Text>
      {!isElevated ? (
        <Pressable
          onPress={() => void Linking.openURL(PREMIUM_SUBSCRIBE_URL)}
          accessibilityRole="link"
          className="flex-row items-center gap-1"
          style={{ minHeight: 44, justifyContent: 'center' }}
        >
          <Crown size={14} color="#ce74e3" fill="#ce74e3" />
          <Text className="font-bold text-premium" style={{ fontSize: 11.5 }}>
            Premium
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
