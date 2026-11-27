// Every screen in every state it has. It renders: never its layout or copy.

import { render } from "@testing-library/react-native";
import * as Updates from "expo-updates";

import { QueryClientProvider } from "@tanstack/react-query";

import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { setSession } from "@/features/auth";
import { CodeScreen } from "@/features/auth/screens/code-screen";
import { queryClient } from "@/lib/query";
import { pageUrl } from "@/features/auth/screens/open-screen";
import { PhoneScreen } from "@/features/auth/screens/phone-screen";
import { SuspendedScreen } from "@/features/auth/screens/suspended-screen";
import { WelcomeScreen } from "@/features/auth/screens/welcome-screen";
import { applyUpdate, UpdateView } from "@/features/auth/screens/update-screen";
import { LocationProvider } from "@/features/discovery/location-context";
import { SearchScreen } from "@/features/discovery/screens/search-screen";
import { HomeView, type HomeState } from "@/features/discovery/screens/home-screen";
import { chipsFor } from "@/features/discovery/families";
import { MeView, type MeState } from "@/features/settings/screens/me-screen";

jest.mock("react-native-maps", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: (props: { children?: unknown }) => React.createElement(View, props, props.children),
    Marker: View,
    PROVIDER_GOOGLE: "google",
  };
});

const nothing = () => undefined;
const error = { kind: "error" as const, message: "No.", offline: false, requestId: "r1" };
const place = {
  id: "a", slug: null, name: "Pinto", category: "Bar", photo: null, priceLevel: 2, rating: 4.4, reviews: 583,
  hours: null, timezone: null, zone: null, distanceKm: 0.1, isPremier: true, isAd: true, lat: 25.6, lng: -100.3,
};

const home: HomeState[] = [
  { kind: "loading" }, { kind: "no-location" }, { kind: "empty" }, { kind: "nothing-saved" }, error, { ...error, offline: true },
  { kind: "places", places: [place] },
];
test.each(home)("Home: $kind", async (state) => {
  const view = await render(
    <HomeView state={state} location="Roma" chips={chipsFor(true)} chip="near" onChip={nothing}
      isSaved={() => true} onSave={nothing} onShare={nothing} refreshing={false} onRefresh={nothing} onEnd={nothing}
      onOpenPlace={nothing} onChooseLocation={nothing} onMenu={nothing} onWelcome={nothing} />,
  );
  expect(view.toJSON()).not.toBeNull();
});

const profile = { id: "g", firstName: "Ana", lastName: null, sex: null, birthYear: null, phone: null, isVip: true, instagramHandle: null };
const me: MeState[] = [
  { kind: "anonymous" }, { kind: "loading" }, error, { ...error, offline: true },
  { kind: "profile", profile, lastUpdated: null }, { kind: "profile", profile, lastUpdated: 1 },
];
test.each(me)("Me: $kind", async (state) => {
  const view = await render(<MeView state={state} signIn={<EmptyState title="Sign" />} onRetry={nothing} />);
  expect(view.toJSON()).not.toBeNull();
});

test.each(["downloading", "failed", "store"] as const)("Update: %s", async (state) => {
  const view = await render(<UpdateView state={state} onRetry={nothing} onStore={nothing} />);
  expect(view.toJSON()).not.toBeNull();
});

test("sign-in, suspended and the shared states", async () => {
  setSession({ notice: "You were signed out.", suspended: "Write to us." });
  for (const screen of [
    <PhoneScreen key="1" onSent={nothing} />,
    <CodeScreen key="2" phone="+52" onWrongNumber={nothing} />,
    <SuspendedScreen key="3" />,
    <EmptyState key="4" title="None." />,
    <ErrorState key="5" message="No." />,
    <WelcomeScreen key="6" onSignIn={nothing} onBrowse={nothing} />,
    <QueryClientProvider key="7" client={queryClient}>
      <LocationProvider>
        <SearchScreen onChooseLocation={nothing} onMenu={nothing} onOpen={nothing} onSignIn={nothing} />
      </LocationProvider>
    </QueryClientProvider>,
  ]) {
    expect((await render(screen)).toJSON()).not.toBeNull();
  }
});

test("the update screen never loops", async () => {
  const check = Updates.checkForUpdateAsync as jest.Mock;
  expect(await applyUpdate()).toBe("store");
  check.mockResolvedValue({ isAvailable: true, manifest: { id: "u2" } });
  expect(await applyUpdate()).toBe("reloading");
  // Still refused after applying it.
  expect(await applyUpdate()).toBe("store");
  expect(Updates.reloadAsync).toHaveBeenCalledTimes(1);
  check.mockResolvedValue({ isAvailable: true, manifest: { id: "u3" } });
  (Updates.fetchUpdateAsync as jest.Mock).mockRejectedValueOnce(new Error("offline"));
  expect(await applyUpdate()).toBe("failed");
  expect(await applyUpdate()).toBe("reloading");
});

test("the browser opens mesita.ai and nothing else", () => {
  expect(pageUrl("/place/1?a=2")).toBe("https://mesita.ai/place/1?a=2");
  for (const page of ["//evil.test", "https://evil.test", "@evil.test", ".evil.test", "/\\evil.test"]) {
    expect(new URL(pageUrl(page)).origin).toBe("https://mesita.ai");
  }
});
