import { useRouter } from "expo-router";

import { WelcomeScreen } from "@/features/auth/screens/welcome-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return <WelcomeScreen onSignIn={() => router.replace("/sign-in")} onBrowse={() => router.back()} />;
}
