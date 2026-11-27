import { useLocalSearchParams, useRouter } from "expo-router";

import { CodeScreen } from "@/features/pay/screens/code-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const { placeId } = useLocalSearchParams<{ placeId?: string }>();
  return <CodeScreen placeId={placeId ?? ""} onClose={() => router.back()} />;
}
