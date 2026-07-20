import { BlurView } from 'expo-blur';
import { CalendarCheck, QrCode, Search, User } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MesitaMark } from '@/components/brand/MesitaMark';
import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
import { COLORS } from '@/constants/brand';
import { isTabParked, PARKED, type ParkedTabKey } from '@/lib/parked-flags';
import { useAuth } from '@/providers/auth';

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
  reservations: CalendarCheck,
};

const ICONS: Record<string, IconComponent> = {
  home: MesitaMark as IconComponent,
  search: Search,
  rewards: QrCode,
  reservations: CalendarCheck,
  me: User,
};

const LABELS: Record<string, string> = {
  home: 'Home',
  search: 'Search',
  rewards: 'Rewards',
  reservations: 'Reservations',
  me: 'Me',
};

// Custom tab bar — RN port of web BottomNav: card/95 + blur, active top
// pill + tinted icon circle + stroke-weight swap, dynamic `Me · <class>`.
// Parked flags/copy live in parked-flags.ts (flip `soon` to unpark).
export function ConsumerTabBar({ state, navigation }: ConsumerTabBarProps) {
  const insets = useSafeAreaInsets();
  const { consumerClass } = useAuth();
  const classLabel =
    consumerClass?.key === 'premium' ? 'Premium' : 'Free';
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
            intensity={48}
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
            const baseLabel = LABELS[name] ?? name;
            const displayLabel =
              name === 'me' ? `${baseLabel} · ${classLabel}` : baseLabel;
            const tint = focused ? COLORS.primary : COLORS.mutedForeground;
            const stroke = focused ? 2.25 : 1.75;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={displayLabel}
                onPress={() => {
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
                className="relative min-w-0 flex-1 items-center gap-1 rounded-lg px-0.5 py-1"
              >
                {focused && !parked ? (
                  <View
                    className="absolute h-0.5 w-5 rounded-full bg-primary"
                    style={{ top: -8, left: '50%', marginLeft: -10 }}
                  />
                ) : null}

                <View
                  className={
                    focused && !parked
                      ? 'h-8 w-8 items-center justify-center rounded-full bg-primary/10'
                      : 'h-8 w-8 items-center justify-center rounded-full'
                  }
                  style={
                    focused && !parked
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
                    focused && !parked
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
