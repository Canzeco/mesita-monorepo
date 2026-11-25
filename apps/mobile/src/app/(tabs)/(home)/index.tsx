import { useRouter } from "expo-router";
import { useCallback } from "react";

import { HomeScreen } from "@/features/discovery/screens/home-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const welcome = useCallback(() => router.push("/welcome"), [router]);
  return (
    <HomeScreen
      // The place screen is step 3: until then a place opens as its web page.
      onOpenPlace={(placeId) => router.push({ pathname: "/open", params: { page: `/place/${placeId}` } })}
      onChooseLocation={() => router.push("/location")}
      onMenu={() => router.push("/categories")}
      onWelcome={welcome}
    />
  );
}
