import { useLocalSearchParams, useRouter } from "expo-router";

import { MenuScreen } from "@/features/place/screens/menu-screen";

export default function Route() {
  const { id, index } = useLocalSearchParams<{ id: string; index?: string }>();
  const router = useRouter();
  const placeId = typeof id === "string" ? id : "";
  const n = typeof index === "string" && /^\d+$/.test(index) ? Number(index) : null;
  return (
    <MenuScreen
      id={placeId}
      index={n}
      onOpen={(i) => router.push({ pathname: "/place/[id]/menu", params: { id: placeId, index: String(i) } })}
    />
  );
}
