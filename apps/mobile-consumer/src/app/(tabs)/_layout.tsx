import { Tabs } from 'expo-router';

import { ConsumerTabBar } from '@/components/ui/ConsumerTabBar';

// Custom tab bar ports web BottomNav (MESITA-581). Rewards stays parked
// behind ComingSoonModal; Reservations navigates to Upcoming/History empty
// states (MESITA-569 — web parked page content).
export default function TabsLayout() {
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
      <Tabs.Screen name="rewards" options={{ title: 'Rewards' }} />
      <Tabs.Screen name="reservations" options={{ title: 'Reservations' }} />
      <Tabs.Screen name="me" options={{ title: 'Me' }} />
    </Tabs>
  );
}
