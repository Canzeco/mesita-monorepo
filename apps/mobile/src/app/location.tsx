import { useRouter } from "expo-router";

import { LocationScreen } from "@/features/discovery/screens/location-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return <LocationScreen onDone={() => router.back()} onSignIn={() => router.replace("/sign-in")} />;
}
