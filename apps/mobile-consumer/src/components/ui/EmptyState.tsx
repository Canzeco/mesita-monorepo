import { LinearGradient } from 'expo-linear-gradient';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { COLORS, GRADIENTS, GRADIENT_DIAGONAL } from '@/constants/brand';

// Shared empty state — mirror of web components/shared/EmptyState.tsx.
//
// Two rules the ad-hoc versions kept getting wrong:
//
//  1. It CENTRES in the space it's given rather than pinning to the top of a
//     tall scroll view. A box floating above 700px of nothing reads as a screen
//     that failed to load, not as a calm zero state.
//  2. It carries an ACTION. "Swipe right on a place to save it" says what to do
//     without giving a way to do it. An empty state with no next step is a dead
//     end.
//
// No dashed decorative box: cards only when interactive, and a zero state isn't.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="flex-1 items-center justify-center px-6 pb-10">
      <View className="size-14 items-center justify-center rounded-2xl bg-primary/10">
        <Icon color={COLORS.primary} size={28} strokeWidth={2} />
      </View>
      <Text className="mt-4 font-display text-lg font-semibold tracking-tight text-foreground">
        {title}
      </Text>
      {description ? (
        <Text className="mt-1.5 max-w-[30ch] text-center text-sm leading-relaxed text-muted-foreground">
          {description}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          className="mt-5 overflow-hidden rounded-full active:opacity-90"
        >
          <LinearGradient
            colors={[...GRADIENTS.pink]}
            start={GRADIENT_DIAGONAL.start}
            end={GRADIENT_DIAGONAL.end}
            style={{
              height: 44,
              paddingHorizontal: 24,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text className="text-sm font-semibold text-white">
              {action.label}
            </Text>
          </LinearGradient>
        </Pressable>
      ) : null}
    </View>
  );
}
