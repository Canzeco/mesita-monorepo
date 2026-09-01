import { BlurView } from 'expo-blur';
import {
  Inbox as InboxIcon,
  QrCode,
  Search,
  User,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MesitaMark } from '@/components/brand/MesitaMark';
import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { COLORS } from '@/constants/brand';
import { isTabParked, PARKED, type ParkedTabKey } from '@/lib/parked-flags';
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

const SOON_ICONS: Record<ParkedTabKey, IconComponent> = {
  rewards: QrCode,
  inbox: InboxIcon,
};

const ICONS: Record<string, IconComponent> = {
  home: MesitaMark as IconComponent,
  search: Search,
  rewards: QrCode,
  inbox: InboxIcon,
  me: User,
};

// The route is now named `inbox` too — it used to be `reservations`, the tab
// wearing a container's name while holding exactly one thing. It holds four
// sections (Visits · Orders · Reservations · Notifications), so it can't be
// named after any one of them. Icon is an inbox tray, not a calendar: a
// calendar named RESERVATIONS. Web BottomNav parity.
// The third tab is "Pay" (Pato, 2026-08-17): named for what the guest came to
// DO, not for the object it creates. THE LABEL MOVED, AND NOTHING ELSE — the
// route is still `(tabs)/rewards`, matching web's /new-visit.
const LABELS: Record<string, string> = {
  home: 'Home',
  search: 'Search',
  rewards: 'Pay',
  inbox: 'Activity',
  me: 'Me',
};

// Custom tab bar — RN port of web BottomNav: card/95 + blur, active top
// pill + tinted icon circle + stroke-weight swap.
//
// Every tab shows its plain label. Me used to append the live class ("Me ·
// Standard") — dropped 2026-08-16 (Pato: "only write me, its cleaner"). A tab
// label names a DESTINATION; the class is status, and it belongs on the Me
// screen where it can be read and acted on, not in the chrome of every screen.
// Parked flags/copy live in parked-flags.ts (flip `soon` to unpark).
// Deep-linked parked routes stay live; tab tap always opens ComingSoonModal.
export function ConsumerTabBar({ state, navigation }: ConsumerTabBarProps) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [soonKey, setSoonKey] = useState<ParkedTabKey | null>(null);
  const soon = soonKey ? PARKED.tabs[soonKey] : null;
  const SoonIcon = soonKey ? SOON_ICONS[soonKey] : undefined;

  return (
    <>
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
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const name = route.name;
            const Icon = ICONS[name] ?? User;
            const parked = isTabParked(name);
            const displayLabel = LABELS[name] ?? name;
            // Parked tabs never show focused chrome (web BottomNav soon buttons).
            const showActive = focused && !parked;
            const tint = showActive ? COLORS.primary : COLORS.mutedForeground;
            const stroke = showActive ? 2.25 : 1.75;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: showActive }}
                accessibilityLabel={displayLabel}
                onPress={() => {
                  // Parked: modal only — even when already on the deep-linked page.
                  if (parked) {
                    setSoonKey(name);
                    return;
                  }
                  const event = navigation.emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  });
                  if (!focused && !event.defaultPrevented) {
                    navigation.navigate(route.name, route.params);
                  }
                }}
                className="relative min-h-[44px] min-w-0 flex-1 items-center justify-end gap-1 rounded-lg px-0.5 py-1"
                style={({ pressed }) => ({
                  transform: [
                    { scale: pressed && !reduceMotion ? 0.96 : 1 },
                  ],
                  opacity: pressed && parked ? 0.85 : 1,
                })}
              >
                {showActive ? (
                  <View
                    className="absolute h-0.5 w-5 rounded-full bg-primary"
                    style={{ top: -8, left: '50%', marginLeft: -10 }}
                  />
                ) : null}

                <View
                  className={
                    showActive
                      ? 'h-8 w-8 items-center justify-center rounded-full bg-primary/10'
                      : 'h-8 w-8 items-center justify-center rounded-full'
                  }
                  style={
                    showActive
                      ? {
                          borderWidth: 1,
                          borderColor: 'rgba(251, 43, 123, 0.2)',
                        }
                      : undefined
                  }
                >
                  <Icon color={tint} size={20} strokeWidth={stroke} />
                </View>

                <Text
                  numberOfLines={1}
                  className={
                    showActive
                      ? 'w-full text-center font-medium text-primary'
                      : 'w-full text-center font-medium text-muted-foreground'
                  }
                  style={{ fontSize: 10 }}
                >
                  {displayLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Home-indicator affordance — matches web BottomNav. */}
        <View className="mx-auto mb-1 mt-1.5 h-1 w-32 rounded-full bg-foreground/20" />
      </View>

      <ComingSoonModal
        open={soon != null}
        onClose={() => setSoonKey(null)}
        title={soon?.title ?? 'Coming soon'}
        body={soon?.body}
        icon={SoonIcon}
      />
    </>
  );
}
