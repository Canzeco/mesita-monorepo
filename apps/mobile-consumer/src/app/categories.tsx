import { useLocalSearchParams, useRouter } from "expo-router";

import { CategoriesScreen } from "@/features/discovery/screens/categories-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  // Home's window leads with Social; Search's has no Social (the web's CategoriesModal `lead`).
  const { from } = useLocalSearchParams<{ from?: string }>();
  return <CategoriesScreen home={from !== "search"} onClose={() => router.back()} />;
}
