import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type PressableProps,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';

type Variant = 'primary' | 'outline' | 'ghost';

export function Button({
  children,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: PressableProps['onPress'];
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
}) {
  const inert = Boolean(disabled || loading);
  const label =
    typeof children === 'string' ? (
      <Text
        className={
          variant === 'primary'
            ? 'font-semibold text-primary-foreground'
            : 'font-semibold text-foreground'
        }
        style={{ fontSize: 14 }}
      >
        {children}
      </Text>
    ) : (
      children
    );

  const inner = (
    <View className="min-h-[48px] flex-row items-center justify-center gap-2 px-4 py-3.5">
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fffafb' : '#fb2b7b'}
        />
      ) : (
        label
      )}
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: inert, busy: Boolean(loading) }}
      style={({ pressed }) => [
        { opacity: inert ? 0.5 : pressed ? 0.92 : 1 },
        variant === 'primary' ? SHADOW_GLOW : null,
      ]}
    >
      <View style={{ borderRadius: 12, overflow: 'hidden' }}>
        {variant === 'primary' ? (
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
          >
            {inner}
          </LinearGradient>
        ) : (
          <View
            className={
              variant === 'outline'
                ? 'rounded-2xl border border-border bg-card'
                : 'rounded-2xl bg-transparent'
            }
          >
            {inner}
          </View>
        )}
      </View>
    </Pressable>
  );
}
