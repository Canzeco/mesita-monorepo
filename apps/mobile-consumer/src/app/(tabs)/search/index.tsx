import { useRouter } from "expo-router";

import { SearchScreen } from "@/features/discovery/screens/search-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return <SearchScreen onHome={() => router.navigate("/")} />;
}
