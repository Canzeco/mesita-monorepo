import type { ReactNode } from "react";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { GRADIENT_DIAGONAL, GRADIENTS } from "@/constants/brand";

// Shared presentational primitives for the discovery filter sheet (MESITA-672):
// Pill + SectionLabel + a brand-filled RangeSlider driving the When (hour),
// Distance (km) and Randomness (0–5) modules. RN port of web
// discovery-filter-controls.tsx — one copy, both the sheet body and the Where
// search field read from here. The native <input type="range"> becomes a
// responder-driven track (no slider dependency in this app).

const MUTED = "#faeff0";
const SLIDER_FILL = ["#cf0360", "#fb2b7b"] as const; // web secondary → primary
const PRIMARY = "#fb2b7b";

export function SectionLabel({
  children,
  className,
  sub = false,
}: {
  children: ReactNode;
  className?: string;
  /** Sub-row label inside a module (Distance, Categories, …). */
  sub?: boolean;
}) {
  return (
    <Text
      className={`mb-2 font-semibold ${
        sub ? "text-muted-foreground/70" : "text-muted-foreground"
      } ${className ?? ""}`}
      style={{ fontSize: 11, letterSpacing: 0.3 }}
    >
      {children}
    </Text>
  );
}

// Soft borderless pill — muted at rest, brand gradient when selected. min-h-11
// keeps every filter control at the 44px touch floor. `icon` sits before the
// label (a lucide glyph); pass a hex color to it since RN icons don't inherit
// className text color.
export function Pill({
  active,
  onPress,
  icon,
  children,
  accessibilityLabel,
}: {
  active: boolean;
  onPress: () => void;
  icon?: ReactNode;
  children: string;
  accessibilityLabel?: string;
}) {
  const inner = (
    <View className="min-h-11 flex-row items-center justify-center gap-1.5 px-4 py-2.5">
      {icon}
      <Text
        numberOfLines={1}
        className={active ? "font-medium text-white" : "font-medium text-foreground/70"}
        style={{ fontSize: 13 }}
      >
        {children}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={accessibilityLabel ?? children}
      style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      <View style={{ borderRadius: 999, overflow: "hidden" }}>
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
}

// Slim brand-filled slider (hour / km / randomness). The fill runs to the thumb;
// `dimmed` softens it while the module rests on a neutral default but keeps it
// live — dragging is how the user leaves that default. The whole 44px-tall row
// is the touch target and the gesture responder; the visual track (6px, pointer-
// transparent) sits centered inside it. Uses the raw responder props (no
// PanResponder ref) so the handlers stay fresh each render and never read a ref
// during render (React 19 react-hooks/refs).
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
  const [trackW, setTrackW] = useState(0);

  // Position within the row → the nearest stepped value; only fires on a change.
  const setFromX = (x: number) => {
    if (trackW <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / trackW));
    const raw = min + ratio * (max - min);
    const stepped = Math.round((raw - min) / step) * step + min;
    const next = Math.min(max, Math.max(min, stepped));
    if (next !== value) onChange(next);
  };

  const pct = max > min ? (value - min) / (max - min) : 0;
  const thumbLeft = pct * trackW;

  return (
    <View
      className={className}
      style={{ height: 44, justifyContent: "center", opacity: dimmed ? 0.5 : 1 }}
      accessibilityRole="adjustable"
      accessibilityLabel={ariaLabel}
      accessibilityValue={{ min, max, now: value }}
      onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => setFromX(e.nativeEvent.locationX)}
      onResponderMove={(e) => setFromX(e.nativeEvent.locationX)}
    >
      <View
        pointerEvents="none"
        style={{ height: 6, borderRadius: 999, backgroundColor: MUTED }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: Math.max(0, thumbLeft),
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <LinearGradient
            colors={SLIDER_FILL}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ flex: 1 }}
          />
        </View>
        <View
          style={{
            position: "absolute",
            top: -7,
            left: Math.max(0, thumbLeft),
            marginLeft: -10,
            width: 20,
            height: 20,
            borderRadius: 999,
            backgroundColor: PRIMARY,
            borderWidth: 2,
            borderColor: "#ffffff",
            shadowColor: "#260409",
            shadowOpacity: 0.2,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 2 },
            elevation: 3,
          }}
        />
      </View>
    </View>
  );
}
