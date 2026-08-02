import { LinearGradient } from 'expo-linear-gradient';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { CLASSES, CLASS_ICONS } from '@/lib/consumer-classes';
import { baseRateForClass, type RewardClassKey } from '@/lib/reward-segments';

// Four-class comparison (segments v6) — Standard / Premium / Influencer /
// Aura in ladder order. Four columns never fit a phone-width grid, so the
// comparison is a stacked list: one compact row-card per class with the three
// separating facts (door, base discount, reservations). The elevated classes
// share the recommendation/reservation perks by design; the door and the way
// the money is made are what differ. Mirrors web ClassComparison.

const ROWS: {
  key: RewardClassKey;
  door: string;
  discount: string;
  reservations: string;
  tintBg: string;
  textColor: string;
  iconColors: readonly [string, string, ...string[]] | null;
}[] = [
  {
    key: 'standard',
    door: 'Free',
    discount: `Up to ${baseRateForClass('standard')}% base`,
    reservations: '2',
    tintBg: 'rgba(250,239,240,0.5)',
    textColor: 'rgba(38,4,9,0.8)',
    iconColors: null,
  },
  {
    key: 'premium',
    door: '$100/mo',
    discount: `Up to ${baseRateForClass('premium')}% base`,
    reservations: '10',
    tintBg: 'rgba(139,108,232,0.07)',
    textColor: '#6d4fd8',
    iconColors: GRADIENTS.premium,
  },
  {
    key: 'influencer',
    door: '1,000+ IG followers',
    discount: `Up to ${baseRateForClass('influencer')}% + Story bonus`,
    reservations: '10',
    tintBg: 'rgba(14,165,233,0.10)',
    textColor: '#0369a1',
    iconColors: GRADIENTS.sky,
  },
  {
    key: 'aura',
    door: 'By invitation',
    discount: `Up to ${baseRateForClass('aura')}% base — highest`,
    reservations: '10',
    tintBg: 'rgba(251,191,36,0.15)',
    textColor: '#b45309',
    iconColors: GRADIENTS.gold,
  },
];

export function ClassComparison() {
  return (
    <View style={{ gap: 8 }}>
      {ROWS.map((row) => {
        const cls = CLASSES.find((c) => c.id === row.key)!;
        const Icon = CLASS_ICONS[row.key];
        return (
          <View
            key={row.key}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(235,217,219,0.6)',
              backgroundColor: row.tintBg,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            {row.iconColors ? (
              <LinearGradient
                colors={[...row.iconColors]}
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
                <Icon color="#fff" size={16} />
              </LinearGradient>
            ) : (
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#faeff0',
                }}
              >
                <Icon color="#260409" size={16} />
              </View>
            )}
            <View style={{ flex: 1, minWidth: 0 }}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  gap: 6,
                }}
              >
                <Text
                  className="font-display font-bold tracking-tight"
                  style={{ fontSize: 13, color: row.textColor }}
                >
                  {cls.label}
                </Text>
                <Text
                  style={{ fontSize: 11, fontWeight: '500', color: '#775254' }}
                >
                  {row.door}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={{ fontSize: 11.5, color: '#775254', marginTop: 2 }}
              >
                {row.discount} · {row.reservations} reservations/mo
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
