import { useRouter } from "expo-router";

import { SearchScreen } from "@/features/discovery/screens/search-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return (
    <SearchScreen
      onChooseLocation={() => router.push("/location")}
      onMenu={() => router.push("/categories")}
      onOpen={(id) => router.push({ pathname: "/place/[id]", params: { id } })}
      onAdd={() => router.push("/place/add")}
      onSignIn={() => router.push("/me")}
    />
  );
}
