import { useLocalSearchParams, useRouter } from "expo-router";

import { PersonScreen } from "@/features/social/screens/person-screen";

export default function Route() {
  const params = useLocalSearchParams<{ placeId: string; kind: string; at: string }>();
  const router = useRouter();
  const event = {
    placeId: typeof params.placeId === "string" ? params.placeId : "",
    kind: typeof params.kind === "string" ? params.kind : "",
    at: typeof params.at === "string" ? params.at : "",
  };
  return (
    <PersonScreen
      event={event}
      onReport={() => router.push({ pathname: "/social/report", params: event })}
      onBlocked={() => router.back()}
      onOpenPlace={(id) => router.push({ pathname: "/place/[id]", params: { id } })}
    />
  );
}
