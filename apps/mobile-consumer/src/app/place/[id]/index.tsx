import { useLocalSearchParams, useRouter } from "expo-router";

import { useActiveLocation, useSaved, useToggleSaved, type CatalogPlace } from "@/features/discovery";
import { PlaceScreen } from "@/features/place/screens/place-screen";

const stub = (id: string): CatalogPlace => ({
  id, slug: null, name: "", category: null, photo: null, priceLevel: null, rating: null, reviews: null,
  hours: null, timezone: null, zone: null, distanceKm: null, isPremier: false, isAd: false, lat: null, lng: null,
});

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const placeId = typeof id === "string" ? id : "";
  const here = useActiveLocation().location;
  const saved = useSaved();
  const toggle = useToggleSaved();
  const on = saved.data?.ids.includes(placeId) ?? false;
  const go = (page: "menu" | "contact" | "report") =>
    router.push({ pathname: `/place/[id]/${page}`, params: { id: placeId } });
  return (
    <PlaceScreen
      id={placeId}
      center={here ? { lat: here.lat, lng: here.lng } : null}
      saved={on}
      onSave={() => toggle.mutate({ place: saved.data?.places.find((row) => row.id === placeId) ?? stub(placeId), on: !on })}
      onReserve={() => router.push({ pathname: "/reserve/[placeId]", params: { placeId } })}
      onMenu={() => go("menu")}
      onContact={() => go("contact")}
      onReport={() => go("report")}
      onBack={() => router.back()}
    />
  );
}
