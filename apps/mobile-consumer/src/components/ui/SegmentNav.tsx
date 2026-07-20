import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';
import { useReduceMotion } from '@/lib/useReduceMotion';

export type SegmentItem = {
  key: string;
  title: string;
  Icon?: ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;
  // Parked tab: visible + tappable; parent opens a coming-soon modal.
  soon?: boolean;
};

// Pink-pill segment nav — RN port of web-consumer's HomeModeNav /
// `.segment-tab-active`: rounded-full pills, active = brand pink gradient +
// shadow-glow with white label/icon, idle = muted. `soon` tabs stay visible
// and open a parent-owned coming-soon modal (MESITA-383 / MESITA-565 / 601).
export function SegmentNav({
  items,
  value,
  onChange,
}: {
  items: readonly SegmentItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  const reduceMotion = useReduceMotion();
  return (
    <View
      accessibilityRole="tablist"
      className="flex-row items-center gap-1.5"
    >
      {items.map(({ key, title, Icon, soon }) => {
        if (soon) {
          return (
            <Pressable
              key={key}
              onPress={() => onChange(key)}
              accessibilityRole="tab"
              accessibilityLabel={`${title}, coming soon`}
              className="min-h-[44px] flex-1 flex-row items-center justify-center gap-1.5 px-2 py-2.5"
              style={({ pressed }) => [
                {
                  transform: [
                    { scale: pressed && !reduceMotion ? 0.97 : 1 },
                  ],
                },
              ]}
            >
              {Icon ? (
                <Icon color="#775254" size={15} strokeWidth={2.2} />
              ) : null}
              <Text
                numberOfLines={1}
                className="font-semibold text-muted-foreground"
                style={{ fontSize: 12 }}
              >
                {title}
              </Text>
            </Pressable>
          );
        }

        const active = key === value;
        const tint = active ? '#ffffff' : '#775254';
        const inner = (
          <View className="min-h-[44px] flex-row items-center justify-center gap-1.5 px-2 py-2.5">
            {Icon ? <Icon color={tint} size={15} strokeWidth={2.2} /> : null}
            <Text
              numberOfLines={1}
              className={
                active
                  ? 'font-semibold text-white'
                  : 'font-semibold text-muted-foreground'
              }
              style={{ fontSize: 12 }}
            >
              {title}
            </Text>
          </View>
        );
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={title}
            style={({ pressed }) => [
              {
                flex: 1,
                transform: [
                  { scale: pressed && !reduceMotion ? 0.97 : 1 },
                ],
              },
              active ? SHADOW_GLOW : null,
            ]}
          >
            {/* inner wrapper clips the gradient without clipping the glow shadow */}
            <View style={{ borderRadius: 999, overflow: 'hidden' }}>
              {active ? (
                <LinearGradient
                  colors={GRADIENTS.pink}
                  start={GRADIENT_DIAGONAL.start}
                  end={GRADIENT_DIAGONAL.end}
                >
                  {inner}
                </LinearGradient>
              ) : (
                <View className="bg-muted">{inner}</View>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
