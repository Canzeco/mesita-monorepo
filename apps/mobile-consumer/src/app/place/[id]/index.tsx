import { useLocalSearchParams, useRouter } from "expo-router";

import { PlaceScreen } from "@/features/place/screens/place-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const placeId = typeof id === "string" ? id : "";
  const go = (page: "menu" | "contact" | "report") =>
    router.push({ pathname: `/place/[id]/${page}`, params: { id: placeId } });
  return (
    <PlaceScreen
      id={placeId}
      onReserve={() => router.push({ pathname: "/reserve/[placeId]", params: { placeId } })}
      onMenu={() => go("menu")}
      onContact={() => go("contact")}
      onReport={() => go("report")}
    />
  );
}
