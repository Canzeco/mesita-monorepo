import { useRouter } from "expo-router";

import { PhoneScreen } from "@/features/auth/screens/phone-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  return (
    <PhoneScreen
      onSent={(phone) => router.push({ pathname: "/sign-in/code", params: { phone } })}
      onClose={() => (router.canGoBack() ? router.back() : router.replace("/"))}
    />
  );
}
