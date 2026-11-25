import { QueryClientProvider } from "@tanstack/react-query";
import { SplashScreen, Stack, useRouter, type Href } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, type ComponentProps } from "react";

import { headerOptions } from "@/components/header";
import { listen, RouteError, ROUTE_GROUPS, start, takeTarget, useGate, type RootRoute } from "@/features/auth";
import { LocationProvider } from "@/features/discovery";
import { queryClient } from "@/lib/query";
import { startReporting } from "@/lib/report";

export { RouteError as ErrorBoundary };

export const unstable_settings = { anchor: "(tabs)" };

startReporting();
void SplashScreen.preventAutoHideAsync();

// The web's floating window over the dimmed screen.
const WINDOW = { headerShown: false, presentation: "transparentModal", animation: "fade" } as const;

const OPTIONS: Record<RootRoute, ComponentProps<typeof Stack.Screen>["options"]> = {
  "(tabs)": { headerShown: false },
  categories: WINDOW,
  location: WINDOW,
  welcome: WINDOW,
  open: { title: "Mesita" },
  "sign-in": { headerShown: false, presentation: "modal" },
  update: { headerShown: false },
  suspended: { headerShown: false },
  onboarding: { title: "About you", headerBackVisible: false, gestureEnabled: false },
};

export default function RootLayout() {
  useEffect(() => {
    const stop = listen();
    void start();
    return stop;
  }, []);
  return (
    <QueryClientProvider client={queryClient}>
      <LocationProvider>
        <StatusBar style="dark" />
        <Root />
      </LocationProvider>
    </QueryClientProvider>
  );
}

const screens = (names: readonly RootRoute[]) =>
  names.map((name) => <Stack.Screen key={name} name={name} options={OPTIONS[name]} />);

function Root() {
  const { gate, member } = useGate();
  const router = useRouter();

  useEffect(() => {
    if (gate !== "starting") void SplashScreen.hideAsync();
    const target = takeTarget(gate, member);
    if (target) router.push(target as Href);
  }, [gate, member, router]);

  // No navigator at all until the device's own storage has answered.
  if (gate === "starting") return null;

  const open = gate === "open";
  return (
    <Stack screenOptions={headerOptions}>
      <Stack.Protected guard={gate === "update"}>{screens(ROUTE_GROUPS.update)}</Stack.Protected>
      <Stack.Protected guard={gate === "suspended"}>{screens(ROUTE_GROUPS.suspended)}</Stack.Protected>
      <Stack.Protected guard={gate === "onboarding"}>{screens(ROUTE_GROUPS.onboarding)}</Stack.Protected>
      <Stack.Protected guard={open}>{screens(ROUTE_GROUPS.everyone)}</Stack.Protected>
      <Stack.Protected guard={open && !member}>{screens(ROUTE_GROUPS.anonymousOnly)}</Stack.Protected>
      <Stack.Protected guard={open && member} redirectTo={open ? "/sign-in" : undefined}>
        {screens(ROUTE_GROUPS.membersOnly)}
      </Stack.Protected>
    </Stack>
  );
}
