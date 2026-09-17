import { LinearGradient } from 'expo-linear-gradient';
import { Check, type LucideIcon } from 'lucide-react-native';
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { COLORS, GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { DiscountMeter, type DiscountLevel } from './DiscountMeter';

export type ClimbCardData = {
  key: string;
  icon: LucideIcon;
  title: string;
  via?: string;
  accent?: boolean;
  /** Door one-liner under the title row (price / threshold / invite). */
  door?: string;
  discountLevel: DiscountLevel;
  /** The class's perks, rendered as a check-list under the meter. */
  perks?: string[];
  reached: boolean;
  reachedLabel: string;
  /** Secondary actions render as a quiet outline button (web parity). */
  action?: { label: string; onPress: () => void; secondary?: boolean };
  note?: string;
  /** Custom icon-tile gradient (e.g. Influencer sky, Aura gold). Wins over
   *  the accent default. */
  iconColors?: readonly [string, string, ...string[]];
};

export function ClimbCard({ data }: { data: ClimbCardData }) {
  const Icon = data.icon;
  let footer: ReactNode = null;
  if (data.reached) {
    footer = (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          borderRadius: 10,
          // Reached is an OUTLINED chip with its Check glyph, never a filled
          // one: the action footer's Button is the only filled ink on this
          // card, and a state nobody must act on cannot wear a CTA's clothes.
          borderWidth: 1.5,
          borderColor: COLORS.foreground,
          backgroundColor: COLORS.card,
          paddingVertical: 10,
          minHeight: 44,
        }}
      >
        <Check color={COLORS.foreground} size={14} strokeWidth={3} />
        <Text style={{ color: COLORS.foreground, fontWeight: '700' }}>
          {data.reachedLabel}
        </Text>
      </View>
    );
  } else if (data.action) {
    footer = (
      <Button
        onPress={data.action.onPress}
        variant={data.action.secondary ? 'outline' : 'primary'}
        accessibilityLabel={data.action.label}
      >
        {data.action.label}
      </Button>
    );
  } else if (data.note) {
    footer = (
      <View
        style={{
          borderRadius: 10,
          borderWidth: 1,
          borderColor: COLORS.border,
          backgroundColor: COLORS.muted,
          paddingVertical: 10,
          alignItems: 'center',
          minHeight: 44,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: COLORS.mutedForeground }}>{data.note}</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        // `accent` used to tint this chrome blue. Hierarchy loses its chroma,
        // and a greyed 3%-alpha wash is invisible anyway — the ladder is
        // carried by the tier icon tile, the door line and the meter's fill.
        borderColor: COLORS.border,
        backgroundColor: COLORS.card,
        padding: 20,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        {data.iconColors ? (
          <LinearGradient
            colors={[...data.iconColors]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon color="#fff" size={24} />
          </LinearGradient>
        ) : (
          <LinearGradient
            colors={
              data.accent
                ? [...GRADIENTS.pink]
                : ([COLORS.muted, COLORS.muted] as const)
            }
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon
              color={data.accent ? COLORS.primaryForeground : COLORS.foreground}
              size={24}
            />
          </LinearGradient>
        )}
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Text
              style={{
                fontWeight: '700',
                fontSize: 16,
                color: COLORS.foreground,
              }}
            >
              {data.title}
            </Text>
            {data.via ? (
              <Text
                style={{
                  color: COLORS.mutedForeground,
                  fontSize: 13,
                  fontWeight: '500',
                }}
              >
                via {data.via}
              </Text>
            ) : null}
          </View>
          {data.door ? (
            <Text
              style={{
                color: COLORS.mutedForeground,
                marginTop: 6,
                fontSize: 12,
                lineHeight: 16,
              }}
            >
              {data.door}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={{ marginTop: 16 }}>
        <DiscountMeter level={data.discountLevel} />
      </View>

      {data.perks && data.perks.length > 0 ? (
        <View style={{ marginTop: 14, gap: 8 }}>
          {data.perks.map((perk) => (
            <View
              key={perk}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}
            >
              <View
                style={{
                  marginTop: 1,
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: COLORS.muted,
                }}
              >
                <Check color={COLORS.foreground} size={12} strokeWidth={3} />
              </View>
              <Text
                style={{
                  flex: 1,
                  color: 'rgba(23,23,23,0.85)',
                  fontSize: 12.5,
                }}
              >
                {perk}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {footer ? <View style={{ marginTop: 16 }}>{footer}</View> : null}
    </View>
  );
}
