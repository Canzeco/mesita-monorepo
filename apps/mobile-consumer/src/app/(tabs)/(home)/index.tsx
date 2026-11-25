import { useRouter } from "expo-router";
import { useCallback } from "react";

import { HomeScreen } from "@/features/discovery/screens/home-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const welcome = useCallback(() => router.push("/welcome"), [router]);
  return (
    <HomeScreen
      onOpenPlace={(placeId) => router.push({ pathname: "/place/[id]", params: { id: placeId } })}
      onChooseLocation={() => router.push("/location")}
      onMenu={() => router.push("/categories")}
      onWelcome={welcome}
    />
  );
}
