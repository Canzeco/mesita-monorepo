import { useRouter } from "expo-router";

import { MeScreen } from "@/features/settings/screens/me-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return <MeScreen onSignIn={() => router.push("/sign-in")} />;
}
