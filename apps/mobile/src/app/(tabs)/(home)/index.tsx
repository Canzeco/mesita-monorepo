import { useRouter } from "expo-router";

import { HomeScreen } from "@/features/discovery/screens/home-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return (
    <HomeScreen
      // The place screen is step 3: until then a place opens as its web page.
      onOpenPlace={(placeId) => router.push({ pathname: "/open", params: { page: `/place/${placeId}` } })}
      onChooseLocation={() => router.push("/location")}
    />
  );
}
