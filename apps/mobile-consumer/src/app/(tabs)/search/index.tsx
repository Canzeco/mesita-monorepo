import { useRouter } from "expo-router";

import { SearchScreen } from "@/features/discovery/screens/search-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return (
    <SearchScreen
      onChooseLocation={() => router.push("/location")}
      onMenu={() => router.push({ pathname: "/categories", params: { from: "search" } })}
      onOpen={(id) => router.push({ pathname: "/place/[id]", params: { id } })}
      onReserve={(id) => router.push({ pathname: "/reserve/[placeId]", params: { placeId: id } })}
      onAdd={(at) => router.push(at ? { pathname: "/place/add", params: { lat: String(at.lat), lng: String(at.lng) } } : "/place/add")}
      onSignIn={() => router.push("/me")}
    />
  );
}
