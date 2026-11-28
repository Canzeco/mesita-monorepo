import { useLocalSearchParams, useRouter } from "expo-router";

import { AddPlaceScreen } from "@/features/place/screens/add-screen";

export default function Route() {
  const router = useRouter();
  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const near = lat && lng && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) ? { lat: Number(lat), lng: Number(lng) } : null;
  return (
    <AddPlaceScreen
      near={near}
      onSignIn={() => router.push("/sign-in")}
      onCreated={(id) => router.replace({ pathname: "/place/[id]", params: { id } })}
    />
  );
}
