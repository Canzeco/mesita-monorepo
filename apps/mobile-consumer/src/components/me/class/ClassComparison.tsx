import { LinearGradient } from 'expo-linear-gradient';
import { Minus } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { CLASS_ICONS } from '@/lib/consumer-classes';
import {
  baseRateForClass,
  PEAK_STRATEGY,
  REWARD_SEGMENTS,
  type RewardClassKey,
} from '@/lib/reward-segments';

// Four-class comparison (segments v6) — a 5-column perk table (Pato,
// 2026-08-02): one label column + Standard / Premium / Influencer / Aura in
// ladder order, one row per perk. Cells stay tiny (10–12px) so the full table
// fits a phone width; each class column carries its identity tint end to end
// (violet / sky / gold). Values derive from reward-segments so the table can
// never drift from the grid the bill engine reads. Mirrors web
// ClassComparison — keep the twins structurally identical.

const STORY_RATE = REWARD_SEGMENTS.find((s) => s.key === 'story')!.rates[
  PEAK_STRATEGY
];

const COLS: {
  key: RewardClassKey;
  label: string;
  door: string;
  textColor: string;
  tintBg: string;
  iconColors: readonly [string, string, ...string[]] | null;
}[] = [
  {
    key: 'standard',
    label: 'Standard',
    door: 'Free',
    textColor: 'rgba(38,4,9,0.8)',
    tintBg: 'rgba(250,239,240,0.5)',
    iconColors: null,
  },
  {
    key: 'premium',
    label: 'Premium',
    door: '$100/mo',
    textColor: '#6d4fd8',
    tintBg: 'rgba(139,108,232,0.07)',
    iconColors: GRADIENTS.premium,
  },
  {
    key: 'influencer',
    label: 'Influencer',
    door: '1K+ IG',
    textColor: '#0369a1',
    tintBg: 'rgba(14,165,233,0.10)',
    iconColors: GRADIENTS.sky,
  },
  {
    key: 'aura',
    label: 'Aura',
    door: 'Invite',
    textColor: '#b45309',
    tintBg: 'rgba(251,191,36,0.15)',
    iconColors: GRADIENTS.gold,
  },
];

// One row per perk. `values` align with COLS; null renders the muted dash.
const ROWS: { label: string; values: (string | null)[] }[] = [
  {
    label: 'Base discount',
    values: COLS.map((c) => `${baseRateForClass(c.key)}%`),
  },
  { label: 'Story bonus', values: [null, null, `+${STORY_RATE}%`, null] },
  { label: 'Recommendations', values: ['Basic', 'Better', 'Better', 'Better'] },
  { label: 'Reservations', values: ['2/mo', '10/mo', '10/mo', '10/mo'] },
];

// Flex weights: label column + four equal class columns (web GRID_COLS twin).
const LABEL_FLEX = 1.15;
const COL_FLEX = 0.82;

export function ClassComparison() {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(235,217,219,1)',
        backgroundColor: '#fff',
        paddingHorizontal: 8,
        paddingVertical: 8,
      }}
    >
      {/* Header — the four classes, each with its door. */}
      <View style={{ flexDirection: 'row', gap: 4, alignItems: 'flex-end' }}>
        <View style={{ flex: LABEL_FLEX }} />
        {COLS.map((col) => {
          const Icon = CLASS_ICONS[col.key];
          return (
            <View
              key={col.key}
              style={{
                flex: COL_FLEX,
                alignItems: 'center',
                gap: 4,
                backgroundColor: col.tintBg,
                borderTopLeftRadius: 8,
                borderTopRightRadius: 8,
                paddingTop: 8,
                paddingBottom: 6,
                paddingHorizontal: 2,
              }}
            >
              {col.iconColors ? (
                <LinearGradient
                  colors={[...col.iconColors]}
                  start={GRADIENT_DIAGONAL.start}
                  end={GRADIENT_DIAGONAL.end}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon color="#fff" size={12} />
                </LinearGradient>
              ) : (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#faeff0',
                  }}
                >
                  <Icon color="#260409" size={12} />
                </View>
              )}
              <Text
                numberOfLines={1}
                className="font-display font-bold tracking-tight"
                style={{ fontSize: 10.5, color: col.textColor }}
              >
                {col.label}
              </Text>
              <Text
                numberOfLines={1}
                style={{ fontSize: 9, fontWeight: '500', color: '#775254' }}
              >
                {col.door}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Perk rows. */}
      {ROWS.map((row, ri) => {
        const last = ri === ROWS.length - 1;
        return (
          <View key={row.label} style={{ flexDirection: 'row', gap: 4 }}>
            <View
              style={{
                flex: LABEL_FLEX,
                justifyContent: 'center',
                paddingLeft: 6,
                borderTopWidth: ri > 0 ? 1 : 0,
                borderTopColor: 'rgba(235,217,219,0.5)',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: 'rgba(38,4,9,0.8)',
                }}
              >
                {row.label}
              </Text>
            </View>
            {row.values.map((v, ci) => (
              <View
                key={COLS[ci].key}
                style={{
                  flex: COL_FLEX,
                  minHeight: 36,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 2,
                  backgroundColor: COLS[ci].tintBg,
                  borderBottomLeftRadius: last ? 8 : 0,
                  borderBottomRightRadius: last ? 8 : 0,
                }}
              >
                {v == null ? (
                  <Minus color="rgba(119,82,84,0.5)" size={12} />
                ) : (
                  <Text
                    numberOfLines={1}
                    style={{
                      fontSize: 11,
                      fontWeight: '600',
                      textAlign: 'center',
                      fontVariant: ['tabular-nums'],
                      color: COLS[ci].textColor,
                    }}
                  >
                    {v}
                  </Text>
                )}
              </View>
            ))}
          </View>
        );
      })}

      <Text
        style={{
          fontSize: 10,
          lineHeight: 13,
          color: 'rgba(119,82,84,0.8)',
          paddingHorizontal: 6,
          paddingTop: 8,
          paddingBottom: 2,
        }}
      >
        Rates are the top of each range — every place sets its own level. First
        visits and Google reviews can beat any class rate; you always keep your
        single best discount.
      </Text>
    </View>
  );
}
