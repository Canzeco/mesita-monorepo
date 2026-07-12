import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS } from '@/constants/brand';
import { useReduceMotion } from '@/lib/useReduceMotion';

export type BoxTint =
  | 'pink'
  | 'sky'
  | 'emerald'
  | 'violet'
  | 'amber'
  | 'muted'
  | 'premium';

// Ports web ProfileClient BOX_TINT — each Me option-box icon gets its own
// tinted tile so the page reads premium, never a flat gray stack.
const SOLID_TINT: Record<Exclude<BoxTint, 'pink' | 'premium'>, string> = {
  sky: 'bg-sky-500/15',
  emerald: 'bg-emerald-500/15',
  violet: 'bg-violet-500/15',
  amber: 'bg-amber-400/20',
  muted: 'bg-muted',
};

const ICON_COLOR: Record<BoxTint, string> = {
  pink: '#ffffff',
  sky: '#0284c7',
  emerald: '#059669',
  violet: '#7c3aed',
  amber: '#b45309',
  muted: 'rgba(38,4,9,0.7)',
  premium: '#ffffff',
};

export function TintedIconTile({
  tint,
  children,
  size = 44,
}: {
  tint: BoxTint;
  children: ReactNode;
  size?: number;
}) {
  const radius = 12; // web rounded-2xl on mobile scale
  if (tint === 'pink' || tint === 'premium') {
    return (
      <LinearGradient
        colors={tint === 'premium' ? [...GRADIENTS.premium] : [...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </LinearGradient>
    );
  }
  return (
    <View
      className={SOLID_TINT[tint]}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export function BoxShell({
  iconTint,
  icon,
  title,
  summary,
  onPress,
  disabled,
  soon = false,
}: {
  iconTint: BoxTint;
  icon: ReactNode;
  title: string;
  summary: string;
  onPress: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  // Parked (soon) rows are BLOCKED, not removed — web parity. No Alert.
  const reduceMotion = useReduceMotion();
  const inert = Boolean(disabled || soon);
  return (
    <Pressable
      onPress={soon ? undefined : onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert }}
      accessibilityLabel={soon ? `${title}, coming soon` : `${title}. ${summary}`}
      style={({ pressed }) => [
        {
          opacity: inert ? 0.6 : pressed && !reduceMotion ? 0.92 : 1,
          transform: [
            {
              scale: pressed && !inert && !reduceMotion ? 0.99 : 1,
            },
          ],
        },
      ]}
      className="mb-2 min-h-[56px] flex-row items-center gap-3.5 rounded-2xl border border-border bg-card p-4"
    >
      <TintedIconTile tint={iconTint}>{icon}</TintedIconTile>
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text
            className="font-bold text-foreground"
            style={{ fontSize: 15 }}
            numberOfLines={1}
          >
            {title}
          </Text>
          {soon ? (
            <View className="rounded-full border border-border px-1.5 py-0.5">
              <Text
                className="font-semibold uppercase text-muted-foreground"
                style={{ fontSize: 8, letterSpacing: 1 }}
              >
                Soon
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          className="text-muted-foreground"
          style={{ fontSize: 12 }}
          numberOfLines={1}
        >
          {summary}
        </Text>
      </View>
      {!soon ? <ChevronRight color="#775254" size={16} /> : null}
    </Pressable>
  );
}

export function BoxRow({
  Icon,
  tint,
  title,
  summary,
  onPress,
  disabled,
  soon,
}: {
  Icon: LucideIcon;
  tint: BoxTint;
  title: string;
  summary: string;
  onPress: () => void;
  disabled?: boolean;
  soon?: boolean;
}) {
  return (
    <BoxShell
      iconTint={tint}
      icon={<Icon color={ICON_COLOR[tint]} size={22} />}
      title={title}
      summary={summary}
      onPress={onPress}
      disabled={disabled}
      soon={soon}
    />
  );
}
