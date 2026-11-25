import { useLocalSearchParams, useRouter } from "expo-router";

import { CodeScreen } from "@/features/auth/screens/code-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  return <CodeScreen phone={phone} onWrongNumber={() => router.back()} />;
}
