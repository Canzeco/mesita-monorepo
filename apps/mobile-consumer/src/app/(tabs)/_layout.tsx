import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";

import { TabBar, TabBarBoundary, type TabItem } from "@/components/tab-bar";
import { useGate, useMyProfile } from "@/features/auth";
import { useUnseenCount } from "@/features/notifications";
import { report } from "@/lib/report";

// THE DRAWN BAR (Pato, 2026-11-28, MESITA-5102): JavaScript tabs with
// Mesita's own bar, not the system's glass one. The items and their order
// are the web's (BottomNav.tsx): Home · Search · Pay · Bookings · Me, and
// signed out Home · Search · Sign.
const MEMBER: readonly TabItem[] = [
  { route: "(home)", label: "Home", icon: "mark" },
  { route: "search", label: "Search", icon: "search" },
  { route: "pay", label: "Pay", icon: "qr" },
  { route: "bookings", label: "Bookings", icon: "calendar-check" },
  { route: "me", label: "Me", icon: "user" },
];
const ANONYMOUS: readonly TabItem[] = [MEMBER[0], MEMBER[1], { route: "me", label: "Sign", icon: "user" }];

/** Screens inside a tab that own the whole frame, as on the web (its route
 *  map's `bar: false`: /pay/code and /pay/receipt). */
const NO_BAR: Record<string, readonly string[]> = { pay: ["code", "receipt"] };

type Nested = { state?: { index?: number; routes: { name: string }[] } };

function hidesBar(route: { name: string } & Nested): boolean {
  const inner = route.state;
  if (!inner) return false;
  const leaf = inner.routes[inner.index ?? inner.routes.length - 1]?.name;
  return leaf !== undefined && (NO_BAR[route.name] ?? []).includes(leaf);
}

function Bar({ state, emitter, navigateToTab }: BottomTabBarProps) {
  const { member } = useGate();
  const avatarUrl = useMyProfile().data?.avatarUrl ?? null;
  const unseen = useUnseenCount(member);
  const items = member ? MEMBER : ANONYMOUS;
  const focused = state.routes[state.index];
  const press = (route: { key: string }, isFocused: boolean) => {
    const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) navigateToTab(route.key);
  };
  return (
    <TabBarBoundary
      items={items}
      onError={(error) => report(error, { where: "tab-bar" })}
      onPick={(name) => {
        const route = state.routes.find((r) => r.name === name);
        if (route) navigateToTab(route.key);
      }}
    >
      <TabBar
        items={items}
        routes={state.routes}
        focusedKey={focused.key}
        onPress={press}
        avatarUrl={avatarUrl}
        unseen={unseen}
        hidden={hidesBar(focused as typeof focused & Nested)}
      />
    </TabBarBoundary>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="firstRoute"
      tabBar={(props) => <Bar {...props} />}
      screenOptions={{ headerShown: false, animation: "none" }}
    >
      <Tabs.Screen name="(home)" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="pay" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="me" />
    </Tabs>
  );
}
