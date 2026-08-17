import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';

const SLIDER_THUMB_SIZE = 20;

// Shared presentational primitives for the discovery filter sheet (MESITA-672):
// Pill + SectionLabel + brand-filled RangeSlider. RN port of web
// discovery-filter-controls.tsx.

/** Group tier ABOVE SectionLabel — INTENT (Where · When · What · That). */
export function FilterGroupLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Text
      className={`mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70 ${className ?? ''}`}
    >
      {children}
    </Text>
  );
}

export function SectionLabel({
  children,
  className,
  sub = false,
}: {
  children: ReactNode;
  className?: string;
  sub?: boolean;
}) {
  return (
    <Text
      className={`mb-2 text-[11px] font-semibold tracking-wide ${
        sub ? 'text-muted-foreground/70' : 'text-muted-foreground'
      } ${className ?? ''}`}
    >
      {children}
    </Text>
  );
}

/** Bordered module box for Where / When / What / That / Random. */
export function FilterModule({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <View
      className={`rounded-2xl border border-border bg-card p-4 ${className ?? ''}`}
    >
      <SectionLabel>{label}</SectionLabel>
      {children}
    </View>
  );
}

/** Pill children rendered as raw string/number need a Text wrapper for RN. */
function renderPillLabel(children: ReactNode, textClassName: string) {
  if (typeof children === 'string' || typeof children === 'number') {
    return <Text className={textClassName}>{children}</Text>;
  }
  return children;
}

// `disabled` is for options the model knows but the product can't back yet
// (Order, MESITA-1081) — shown rather than hidden, so the axis reads whole.
export function Pill({
  active,
  onClick,
  children,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <View
        accessibilityRole="button"
        accessibilityState={{ disabled: true, selected: false }}
        className="min-h-11 shrink-0 flex-row items-center gap-1.5 rounded-full bg-muted/40 px-4"
      >
        {renderPillLabel(
          children,
          'text-[13px] font-medium text-muted-foreground/60',
        )}
      </View>
    );
  }

  if (active) {
    return (
      <Pressable
        onPress={onClick}
        accessibilityRole="button"
        accessibilityState={{ selected: true }}
        className="min-h-11 shrink-0 overflow-hidden rounded-full active:opacity-90"
        style={{ borderRadius: 999 }}
      >
        <LinearGradient
          colors={[...GRADIENTS.pink]}
          start={GRADIENT_DIAGONAL.start}
          end={GRADIENT_DIAGONAL.end}
          style={{
            minHeight: 44,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            borderRadius: 999,
          }}
        >
          {renderPillLabel(children, 'text-[13px] font-medium text-white')}
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onClick}
      accessibilityRole="button"
      accessibilityState={{ selected: false }}
      className="min-h-11 shrink-0 flex-row items-center gap-1.5 rounded-full bg-muted/60 px-4 active:bg-muted"
    >
      {renderPillLabel(children, 'text-[13px] font-medium text-foreground/70')}
    </Pressable>
  );
}

/** `soon` tag riding inside a disabled Pill — the parked half of an axis. */
export function PillSoon() {
  return (
    <View className="rounded-full bg-foreground/10 px-1.5 py-0.5">
      <Text className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
        soon
      </Text>
    </View>
  );
}

/** Pill children that mix icon + text need a white/muted text wrapper. */
export function PillText({
  active,
  children,
  disabled = false,
}: {
  active: boolean;
  children: ReactNode;
  disabled?: boolean;
}) {
  // RN doesn't cascade text colour through the Pill's View, so the disabled
  // tone has to be carried here too.
  const tone = disabled
    ? 'text-muted-foreground/60'
    : active
      ? 'text-white'
      : 'text-foreground/70';
  return <Text className={`text-[13px] font-medium ${tone}`}>{children}</Text>;
}

export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  ariaLabel,
  dimmed = false,
  className,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (n: number) => void;
  ariaLabel: string;
  dimmed?: boolean;
  className?: string;
}) {
  const [trackW, setTrackW] = useState(1);
  const pct = max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0;

  const emitFromX = useCallback(
    (x: number, w: number) => {
      if (w <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / w));
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      const next = Math.min(max, Math.max(min, stepped));
      if (next !== value) onChange(next);
    },
    [max, min, onChange, step, value],
  );

  const pan = Gesture.Pan()
    .onBegin((e) => {
      runOnJS(emitFromX)(e.x, trackW);
    })
    .onUpdate((e) => {
      runOnJS(emitFromX)(e.x, trackW);
    });

  const tap = Gesture.Tap().onEnd((e) => {
    runOnJS(emitFromX)(e.x, trackW);
  });

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackW(e.nativeEvent.layout.width);
  };

  return (
    <View
      className={`h-8 justify-center ${className ?? ''}`}
      style={{ opacity: dimmed ? 0.5 : 1 }}
      accessibilityRole="adjustable"
      accessibilityLabel={ariaLabel}
      accessibilityValue={{ min, max, now: value }}
    >
      <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
        <View className="h-8 justify-center" onLayout={onLayout}>
          <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <View
              style={{
                height: '100%',
                width: `${pct * 100}%`,
                borderRadius: 999,
                backgroundColor: COLORS.primary,
              }}
            />
          </View>
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.max(0, pct * trackW - SLIDER_THUMB_SIZE / 2),
              width: SLIDER_THUMB_SIZE,
              height: SLIDER_THUMB_SIZE,
              borderRadius: SLIDER_THUMB_SIZE / 2,
              backgroundColor: COLORS.primary,
              borderWidth: 2,
              borderColor: '#fff',
              top: 6,
            }}
          />
        </View>
      </GestureDetector>
    </View>
  );
}
