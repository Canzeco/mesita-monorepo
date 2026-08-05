import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { CLASSES, CLASS_ICONS, isElevatedClass } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';

export function CurrentClassCard() {
  const { consumerClass, profile } = useAuth();
  const { key, origin } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );
  const meta = CLASSES.find((c) => c.id === key)!;
  const isElevated = isElevatedClass(key);
  // Aura (top of the ladder) inherits the gold treatment; Influencer reads
  // sky; Premium keeps its violet gradient.
  // Keep the readonly tuple shape (see IdentityHero) — spreading into a
  // variable widens it past LinearGradient's `colors` tuple type.
  const elevatedColors =
    key === 'aura'
      ? GRADIENTS.gold
      : key === 'influencer'
        ? GRADIENTS.sky
        : GRADIENTS.premium;
  // The class wears its canonical icon (smile / card / megaphone / sparkles);
  // the origin only sets the "via" line.
  const Icon = CLASS_ICONS[key];
  const via =
    !isElevated
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
      colors={isElevated ? elevatedColors : [...GRADIENTS.free]}
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
          backgroundColor: isElevated
            ? 'rgba(255,255,255,0.2)'
            : 'rgba(38,4,9,0.06)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon color={isElevated ? '#fff' : '#260409'} size={20} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          className="font-display font-semibold tracking-tight"
          style={{
            color: isElevated ? '#fff' : '#260409',
            fontSize: 22,
            textShadowColor: isElevated ? 'rgba(0,0,0,0.35)' : 'transparent',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 6,
          }}
        >
          {meta.label}
        </Text>
        {via ? (
          <Text
            style={{
              color: isElevated ? 'rgba(255,255,255,0.95)' : '#775254',
              fontSize: 11,
              marginTop: 2,
              textShadowColor: isElevated ? 'rgba(0,0,0,0.3)' : 'transparent',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 4,
            }}
          >
            {via}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}
