import { useRouter } from "expo-router";

import { PhoneScreen } from "@/features/auth/screens/phone-screen";
import { useActiveLocation } from "@/features/discovery";
import { MeScreen } from "@/features/settings/screens/me-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const { selectChip } = useActiveLocation();
  const sent = (phone: string) => router.push({ pathname: "/sign-in/code", params: { phone } });
  const go = (path: "/me/profile" | "/me/class" | "/me/notifications" | "/me/tickets" | "/me/card" | "/me/plan" | "/me/share" | "/me/settings") =>
    router.push(path);
  return (
    <MeScreen
      signIn={<PhoneScreen onSent={sent} />}
      nav={{
        onProfile: () => go("/me/profile"),
        onClass: () => go("/me/class"),
        onReservations: () => router.navigate("/bookings"),
        onNotifications: () => go("/me/notifications"),
        onTickets: () => go("/me/tickets"),
        onCard: () => go("/me/card"),
        onSaved: () => {
          selectChip("saved");
          router.navigate("/");
        },
        onPlan: () => go("/me/plan"),
        onShare: () => go("/me/share"),
        onSettings: () => go("/me/settings"),
      }}
    />
  );
}
