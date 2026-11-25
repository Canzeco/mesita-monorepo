import { useLocalSearchParams, useRouter } from "expo-router";

import { ReportPersonScreen } from "@/features/social/screens/report-screen";

export default function Route() {
  const params = useLocalSearchParams<{ placeId: string; kind: string; at: string }>();
  const router = useRouter();
  return (
    <ReportPersonScreen
      event={{
        placeId: typeof params.placeId === "string" ? params.placeId : "",
        kind: typeof params.kind === "string" ? params.kind : "",
        at: typeof params.at === "string" ? params.at : "",
      }}
      onSent={() => router.back()}
    />
  );
}
