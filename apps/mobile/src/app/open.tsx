import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";

import { OpenScreen } from "@/features/auth/screens/open-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const { page } = useLocalSearchParams<{ page?: string }>();
  const close = useCallback(() => (router.canGoBack() ? router.back() : router.replace("/")), [router]);
  return <OpenScreen page={page ?? "/"} onClose={close} />;
}
