import { LinearGradient } from 'expo-linear-gradient';
import { Check, Lock } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { CLASSES, CLASS_ICONS } from '@/lib/consumer-classes';
import { useEffectiveClass } from '@/lib/mock-class';
import { useAuth } from '@/providers/auth';

// The class rail (MESITA-972) — web ClassRail parity. An at-a-glance strip of
// all four classes in canonical ladder order (Standard → Influencer →
// Premium → Aura) showing which DOORS the signed-in consumer holds open: the
// one that currently wins the slot, the ones unlocked underneath it (a paying
// Aura member keeps the Premium chip unlocked — the subscription runs on),
// and the locked ones with the one-word how. Pure status: the ladder is
// strictly increasing, so there is nothing to switch.

const DOOR_HOW: Record<string, string> = {
  standard: 'Base',
  influencer: '2,000+ IG',
  premium: '$50/mo',
  aura: 'Invite',
};

// Aura = gold, Influencer = red, Premium = blue, Standard = free gray
// (MESITA-929 identity set, same source as CurrentClassCard).
const CHIP_GRADIENTS = {
  standard: GRADIENTS.free,
  influencer: GRADIENTS.influencer,
  premium: GRADIENTS.premium,
  aura: GRADIENTS.gold,
} as const;

export function ClassRail() {
  const { consumerClass, profile } = useAuth();
  const { key, doors } = useEffectiveClass(
    consumerClass,
    profile?.instagram_handle ?? null,
  );

  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {CLASSES.map((c) => {
        const Icon = CLASS_ICONS[c.id];
        const current = key === c.id;
        // Standard is a door every account holds open.
        const unlocked =
          current || c.id === 'standard' || doors[c.id as keyof typeof doors];
        const onDark = current && c.id !== 'standard';
        const body = (
          <>
            <Icon
              size={16}
              color={onDark ? '#fff' : unlocked ? '#260409' : '#a98a8d'}
            />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: onDark ? '#fff' : unlocked ? '#260409' : '#775254',
              }}
            >
              {c.label}
            </Text>
            {current ? (
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: '800',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: onDark ? 'rgba(255,255,255,0.9)' : '#260409',
                }}
              >
                Current
              </Text>
            ) : unlocked ? (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              >
                <Check size={10} color="#2563eb" />
                <Text
                  style={{
                    fontSize: 9,
                    fontWeight: '800',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    color: '#2563eb',
                  }}
                >
                  Unlocked
                </Text>
              </View>
            ) : (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
              >
                <Lock size={10} color="#775254" />
                <Text style={{ fontSize: 9, color: '#775254' }}>
                  {DOOR_HOW[c.id]}
                </Text>
              </View>
            )}
          </>
        );
        const chipStyle = {
          flex: 1,
          borderRadius: 12,
          paddingVertical: 10,
          paddingHorizontal: 4,
          alignItems: 'center' as const,
          gap: 4,
        };
        return current ? (
          <LinearGradient
            key={c.id}
            colors={[...CHIP_GRADIENTS[c.id]]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={chipStyle}
          >
            {body}
          </LinearGradient>
        ) : (
          <View
            key={c.id}
            style={{
              ...chipStyle,
              backgroundColor: unlocked ? '#ffffff' : '#faeff0',
              borderWidth: unlocked ? 1 : 0,
              borderColor: '#ebd9db',
            }}
          >
            {body}
          </View>
        );
      })}
    </View>
  );
}
