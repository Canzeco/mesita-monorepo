import { BlurView } from 'expo-blur';
import { CalendarCheck, QrCode, Search, User } from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MesitaMark } from '@/components/brand/MesitaMark';
import { ComingSoonModal } from '@/components/ui/ComingSoonModal';
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

type SoonMeta = {
  title: string;
  body: string;
  Icon: IconComponent;
};

// Parked tab copy — mirrors web BottomNav (MESITA-383).
// Reservations navigates to Upcoming/History empty states (MESITA-569);
// only Rewards stays behind ComingSoonModal on the tab bar.
const SOON: Record<string, SoonMeta> = {
  rewards: {
    title: 'Rewards coming soon',
    body: 'Pay with QR and claim Mesita rewards from here shortly. Hang tight.',
    Icon: QrCode,
  },
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
// Rewards / Reservations open ComingSoonModal instead of navigating.
export function ConsumerTabBar({ state, navigation }: ConsumerTabBarProps) {
  const insets = useSafeAreaInsets();
  const { consumerClass } = useAuth();
  const classLabel =
    consumerClass?.key === 'premium' ? 'Premium' : 'Free';
  const [soonKey, setSoonKey] = useState<string | null>(null);
  const soon = soonKey ? SOON[soonKey] : null;

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
            const soonMeta = SOON[name];
            const baseLabel = LABELS[name] ?? name;
            const displayLabel =
              name === 'me' ? `${baseLabel} · ${classLabel}` : baseLabel;
            const tint = focused ? '#fb2b7b' : '#775254';
            const stroke = focused ? 2.25 : 1.75;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={displayLabel}
                onPress={() => {
                  if (soonMeta) {
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
                {focused && !soonMeta ? (
                  <View
                    className="absolute h-0.5 w-5 rounded-full bg-primary"
                    style={{ top: -8, left: '50%', marginLeft: -10 }}
                  />
                ) : null}

                <View
                  className={
                    focused && !soonMeta
                      ? 'h-8 w-8 items-center justify-center rounded-full bg-primary/10'
                      : 'h-8 w-8 items-center justify-center rounded-full'
                  }
                  style={
                    focused && !soonMeta
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
                    focused && !soonMeta
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
        icon={soon?.Icon}
      />
    </>
  );
}
