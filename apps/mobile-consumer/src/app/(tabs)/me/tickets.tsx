import { useRouter } from "expo-router";

import { TicketsScreen } from "@/features/settings/screens/tickets-screen";

export default function Route() {
  const router = useRouter();
  return (
    <TicketsScreen
      onVisit={(id) => router.push({ pathname: "/me/visit", params: { id } })}
      onGift={(id) => router.push({ pathname: "/me/gift", params: { id } })}
      onVoucher={(place, line) => router.push({ pathname: "/me/credit", params: { place, line } })}
    />
  );
}
