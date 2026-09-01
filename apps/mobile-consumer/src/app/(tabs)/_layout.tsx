import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { ConsumerTabBar } from '@/components/ui/ConsumerTabBar';
import { useAuth } from '@/providers/auth';

// Custom tab bar ports web BottomNav (MESITA-581). Rewards + Reservations
// stay parked behind ComingSoonModal (web BottomNav parity); route screens
// remain for deep links / unpark (MESITA-569 page shells).
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
        <ActivityIndicator color="#fb2b7b" />
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
        <ConsumerTabBar
          state={props.state}
          navigation={props.navigation as never}
        />
      )}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#fff7f8' },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
      <Tabs.Screen name="rewards" options={{ title: 'Pay' }} />
      <Tabs.Screen name="inbox" options={{ title: 'Activity' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
