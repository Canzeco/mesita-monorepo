import { useRouter } from "expo-router";

import { CategoriesScreen } from "@/features/discovery/screens/categories-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return <CategoriesScreen onClose={() => router.back()} />;
}
