import { useEffect, useMemo } from 'react';
import { Animated, type DimensionValue, View } from 'react-native';

import { SHADOW_ELEV } from '@/constants/brand';

// RN port of web-consumer TicketDetailsSkeleton — the structured placeholder
// shown while a ticket loads: the visit card (thumbnail + three pills, then a
// stepper band and a summary band) above the step panel (chip + body + CTA).
// Blocks share one looping opacity pulse so the whole surface breathes like
// the other loading states, replacing the bare spinner. The `tint` variants
// mirror web's /60 and /40 fills that keep the original depth hierarchy.

type Tint = 'base' | 'soft' | 'softer';

const TINT: Record<Tint, string> = {
  base: 'rgba(235,217,219,0.9)',
  soft: 'rgba(235,217,219,0.6)',
  softer: 'rgba(235,217,219,0.4)',
};

function usePulse() {
  const value = useMemo(() => new Animated.Value(0.5), []);
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(value, {
          toValue: 0.5,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  return value;
}

function Block({
  pulse,
  height,
  width = '100%',
  radius = 12,
  flex,
  tint = 'base',
}: {
  pulse: Animated.Value;
  height?: number;
  width?: DimensionValue;
  radius?: number;
  flex?: number;
  tint?: Tint;
}) {
  return (
    <Animated.View
      style={{
        ...(flex != null ? { flex } : {}),
        ...(height != null ? { height } : {}),
        width,
        borderRadius: radius,
        backgroundColor: TINT[tint],
        opacity: pulse,
      }}
    />
  );
}

export function TicketDetailsSkeleton() {
  const pulse = usePulse();

  return (
    <View style={{ gap: 16 }}>
      {/* Visit card */}
      <View
        style={{
          borderRadius: 16,
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: 'rgba(16,185,129,0.15)',
          overflow: 'hidden',
          ...SHADOW_ELEV,
        }}
      >
        <View style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Block pulse={pulse} height={104} width={104} radius={16} />
            <View style={{ flex: 1, gap: 8 }}>
              <Block pulse={pulse} flex={1} tint="soft" radius={12} />
              <Block pulse={pulse} flex={1} tint="soft" radius={12} />
              <Block pulse={pulse} flex={1} tint="soft" radius={12} />
            </View>
          </View>
          <View style={{ marginTop: 12 }}>
            <Block pulse={pulse} height={64} tint="softer" radius={16} />
          </View>
          <View style={{ marginTop: 12 }}>
            <Block pulse={pulse} height={56} radius={16} />
          </View>
        </View>
      </View>

      {/* Step panel */}
      <View
        style={{
          borderRadius: 16,
          backgroundColor: '#ffffff',
          borderWidth: 1,
          borderColor: '#ebd9db',
          overflow: 'hidden',
          ...SHADOW_ELEV,
        }}
      >
        <View style={{ padding: 16, gap: 12 }}>
          <Block pulse={pulse} height={32} width={96} radius={999} />
          <Block pulse={pulse} height={80} radius={16} />
          <Block pulse={pulse} height={48} radius={999} />
        </View>
      </View>
    </View>
  );
}
