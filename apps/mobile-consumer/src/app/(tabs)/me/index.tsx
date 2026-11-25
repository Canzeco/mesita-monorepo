import { useRouter } from "expo-router";

import { PhoneScreen } from "@/features/auth/screens/phone-screen";
import { MeScreen } from "@/features/settings/screens/me-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const sent = (phone: string) => router.push({ pathname: "/sign-in/code", params: { phone } });
  return <MeScreen signIn={<PhoneScreen onSent={sent} />} onProfile={() => router.push("/me/profile")} onClass={() => router.push("/me/class")} onNotifications={() => router.push("/me/notifications")} onSettings={() => router.push("/me/settings")} onDelete={() => router.push("/me/delete")} />;
}
