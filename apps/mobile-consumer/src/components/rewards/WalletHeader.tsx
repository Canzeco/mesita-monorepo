// The wallet's identity header (Wallet v3, MESITA-811) — mobile mirror:
// strictly who you are — avatar, name, class chip. Nothing else by spec: the
// old ContextStrip's "up to N%" ceiling and Premium door left the page, and
// the member code moved into the venue pass modal, next to the QR it backs up.

import { Crown } from 'lucide-react-native';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { classProperLabel, isElevatedClass } from '@/lib/consumer-classes';
import { firstInitials } from '@/lib/utils';
import { useAuth } from '@/providers/auth';

export function WalletHeader({ name }: { name?: string }) {
  const { consumerClass } = useAuth();
  const key = consumerClass?.class ?? 'standard';
  const isElevated = isElevatedClass(key);
  const displayName = name?.trim() || 'Mesita member';

  return (
    <View className="flex-row items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3">
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text className="font-extrabold text-white" style={{ fontSize: 14 }}>
          {firstInitials(displayName)}
        </Text>
      </LinearGradient>
      <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
        <Text
          className="font-bold text-foreground"
          numberOfLines={1}
          style={{ fontSize: 14, flexShrink: 1 }}
        >
          {displayName}
        </Text>
        <View
          className={`flex-row items-center gap-1 rounded-full px-1.5 py-0.5 ${
            isElevated ? 'bg-premium/10' : 'bg-primary/10'
          }`}
        >
          {isElevated ? <Crown size={10} color="#ce74e3" fill="#ce74e3" /> : null}
          <Text
            className={`font-extrabold uppercase ${
              isElevated ? 'text-premium' : 'text-primary'
            }`}
            style={{ fontSize: 9, letterSpacing: 1 }}
          >
            {classProperLabel(key)}
          </Text>
        </View>
      </View>
    </View>
  );
}
