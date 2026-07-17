import { LinearGradient } from 'expo-linear-gradient';
import { AtSign, Crown, Smile } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { CLASSES } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';

export function CurrentClassCard() {
  const { consumerClass, profile } = useAuth();
  const { key, origin } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const meta = CLASSES.find((c) => c.id === key)!;
  const isPremium = key === 'premium';
  const Icon =
    !isPremium ? Smile : origin === 'instagram' ? AtSign : Crown;
  const via =
    !isPremium
      ? null
      : origin === 'instagram'
        ? 'via Instagram'
        : origin === 'subscription'
          ? 'via subscription'
          : origin === 'invitation'
            ? 'via invitation'
            : null;

  return (
    <LinearGradient
      colors={isPremium ? [...GRADIENTS.premium] : [...GRADIENTS.free]}
      start={GRADIENT_DIAGONAL.start}
      end={GRADIENT_DIAGONAL.end}
      style={{
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: isPremium
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(38,4,9,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon color={isPremium ? '#fff' : '#260409'} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: isPremium ? '#fff' : '#260409',
            fontWeight: '700',
          }}
        >
          Mesita {meta.label}
        </Text>
        {via ? (
          <Text
            style={{ color: isPremium ? 'rgba(255,255,255,0.9)' : '#775254' }}
          >
            {via}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}
