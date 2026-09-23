import { BlurView } from 'expo-blur';
import { ShoppingBag, User, Wallet } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MesitaMark } from '@/components/brand/MesitaMark';
import { COLORS } from '@/constants/brand';
import { useReduceMotion } from '@/lib/useReduceMotion';

type IconComponent = ComponentType<{
  color?: string;
  size?: number;
  strokeWidth?: number;
}>;

type TabRoute = {
  key: string;
  name: string;
  params?: object;
};

// Minimal props from Expo Router's tabBar render prop — avoids a hard dep
// on `@react-navigation/bottom-tabs` (resolved via expo-router).
type ConsumerTabBarProps = {
  state: {
    index: number;
    routes: TabRoute[];
  };
  navigation: {
    emit: (event: {
      type: string;
      target: string;
      canPreventDefault: boolean;
    }) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

// FOUR tabs, Visit · Order · Wallet · Me (Pato, MESITA-2050) — web BottomNav
// parity. The bar is a FIXED list, not `state.routes`: the navigator holds
// eight screens (Visit's five pills, Order, Wallet, Me) and the bar shows
// four. Each tab names the route it opens and every route that lights it —
// Visit lights for all five of its pills, the same way web's matchPrefixes
// list does. A pill screen missing from Visit's `routes` renders with NO tab
// lit, the failure web's route-structure T5 exists to catch.
//
// Visit carries the brand mark: the leftmost tab has worn it since Home held
// that slot, and Visit is where Home went.
//
// Every tab shows its plain label (Pato, 2026-08-16: "only write me, its
// cleaner"). A tab label names a DESTINATION; state belongs on the page.
type BarItem = {
  label: string;
  Icon: IconComponent;
  /** The route a tap opens. For Visit that is Home, its leading pill. */
  target: string;
  /** Every route name that lights this tab. */
  routes: readonly string[];
};

export const BAR: readonly BarItem[] = [
  {
    label: 'Visit',
    Icon: MesitaMark as IconComponent,
    target: 'home',
    routes: ['home', 'search', 'chat', 'favs', 'rewards'],
  },
  { label: 'Order', Icon: ShoppingBag, target: 'order', routes: ['order'] },
  { label: 'Wallet', Icon: Wallet, target: 'wallet', routes: ['wallet'] },
  { label: 'Me', Icon: User, target: 'me', routes: ['me'] },
];

// Custom tab bar — RN port of web BottomNav: card/95 + blur, active top
// pill + tinted icon circle + stroke-weight swap.
export function ConsumerTabBar({ state, navigation }: ConsumerTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const current = state.routes[state.index]?.name;

  return (
    <View
      className="border-t border-border"
      style={{ paddingBottom: Math.max(insets.bottom, 6) }}
    >
      {Platform.OS === 'web' ? (
        <View
          className="absolute inset-0 bg-card/95"
          pointerEvents="none"
        />
      ) : (
        <BlurView
          intensity={56}
          tint="light"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      <View
        className="absolute inset-0 bg-card/80"
        pointerEvents="none"
      />

      <View className="relative flex-row items-end justify-around px-0.5 pt-2">
        {BAR.map(({ label, Icon, target, routes }) => {
          const focused = current != null && routes.includes(current);
          const tint = focused ? COLORS.primary : COLORS.mutedForeground;
          const stroke = focused ? 2.25 : 1.75;
          const route = state.routes.find((r) => r.name === target);

          return (
            <Pressable
              key={target}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                if (!route) return;
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                // Tapping a lit tab from one of its other screens (Visit from
                // Search, say) returns to the tab's default, as web's href does.
                if (current !== target && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              }}
              className="relative min-h-[44px] min-w-0 flex-1 items-center justify-end gap-1 rounded-lg px-0.5 py-1"
              style={({ pressed }) => ({
                transform: [{ scale: pressed && !reduceMotion ? 0.96 : 1 }],
              })}
            >
              {focused ? (
                <View
                  className="absolute h-0.5 w-5 rounded-full bg-primary"
                  style={{ top: -8, left: '50%', marginLeft: -10 }}
                />
              ) : null}

              <View
                className={
                  focused
                    ? 'h-8 w-8 items-center justify-center rounded-full bg-primary/10'
                    : 'h-8 w-8 items-center justify-center rounded-full'
                }
                style={
                  focused
                    ? { borderWidth: 1, borderColor: `${COLORS.primary}33` }
                    : undefined
                }
              >
                <Icon color={tint} size={20} strokeWidth={stroke} />
              </View>

              <Text
                numberOfLines={1}
                className={
                  focused
                    ? 'w-full text-center font-medium text-primary'
                    : 'w-full text-center font-medium text-muted-foreground'
                }
                style={{ fontSize: 10 }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Home-indicator affordance — matches web BottomNav. */}
      <View className="mx-auto mb-1 mt-1.5 h-1 w-32 rounded-full bg-foreground/20" />
    </View>
  );
}
