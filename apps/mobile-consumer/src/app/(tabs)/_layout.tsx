import { Redirect, Tabs, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { ConsumerTabBar } from '@/components/ui/ConsumerTabBar';
import { COLORS } from '@/constants/brand';
import { isMeNestedRoute } from '@/lib/tab-layout';
import { useAuth } from '@/providers/auth';

type RoutedTabBarProps = {
  state: Parameters<typeof ConsumerTabBar>[0]['state'];
  navigation: Parameters<typeof ConsumerTabBar>[0]['navigation'];
};

function RoutedTabBar({ state, navigation }: RoutedTabBarProps) {
  const segments = useSegments();
  if (isMeNestedRoute(segments)) return null;
  return <ConsumerTabBar state={state} navigation={navigation} />;
}

// Custom tab bar ports web BottomNav (MESITA-581). The bar shows FOUR tabs,
// Visit · Order · Wallet · Me (MESITA-2050), over EIGHT screens: Visit's five
// rail pills (home · search · chat · favs · rewards) are sibling tab routes,
// so each pill keeps its state across switches. ConsumerTabBar's BAR list
// decides what the bar shows and which routes light which tab; the order of
// the screens below only sets `state.routes` order and the initial route.
export default function TabsLayout() {
  const { loading, session, onboarded } = useAuth();

  // Continuous auth + onboarding guard — the RN equivalent of the web
  // (shell)/layout.tsx, which re-runs getUser() + the onboarded check on
  // every navigation. Because this reads live auth state, a mid-session
  // change (sign-out, token expiry, profile completion) re-renders the tab
  // group and re-evaluates the gate, so no stale authed content is ever left
  // mounted. index.tsx handles the cold-start route; this keeps it true after.
  //
  // Onboarded predicate (full_name && birthday && sex) lives in the provider,
  // mirroring the web shell.
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (!session) {
    return <Redirect href="/sign-in" />;
  }
  if (!onboarded) {
    return <Redirect href="/onboard" />;
  }

  return (
    <Tabs
      tabBar={(props) => (
        // Expo Router's navigation helpers are wider than our minimal prop
        // surface; the cast keeps ConsumerTabBar free of a hard
        // `@react-navigation/bottom-tabs` import (pnpm hoisting).
        // Nested /me/* routes hide the bar — see isMeNestedRoute (MESITA-1812).
        <RoutedTabBar
          state={props.state}
          navigation={props.navigation as never}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="favs" options={{ title: 'Favs' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Pay' }} />
      <Tabs.Screen name="order" options={{ title: 'Order' }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
