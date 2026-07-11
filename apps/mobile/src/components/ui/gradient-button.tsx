import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import { GRADIENT_DIAGONAL, GRADIENTS, SHADOW_GLOW } from '@/constants/brand';

// Port of the web `.btn-primary` (bg-pink-gradient + shadow-glow + white
// semibold label).
export function GradientButton({
  label,
  onPress,
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        SHADOW_GLOW,
        { borderRadius: 8, opacity: inactive ? 0.6 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
      ]}
    >
      <LinearGradient
        colors={[...GRADIENTS.pink]}
        start={GRADIENT_DIAGONAL.start}
        end={GRADIENT_DIAGONAL.end}
        style={{ borderRadius: 8, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' }}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="font-semibold text-sm text-white">{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}
