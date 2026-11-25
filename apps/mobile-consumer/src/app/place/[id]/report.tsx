import { useLocalSearchParams, useRouter } from "expo-router";

import { ReportScreen } from "@/features/place/screens/report-screen";

export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <ReportScreen id={typeof id === "string" ? id : ""} onSent={() => router.back()} />;
}
