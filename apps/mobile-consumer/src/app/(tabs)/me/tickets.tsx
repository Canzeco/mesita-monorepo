import { useRouter } from "expo-router";
import { Linking } from "react-native";

import { TicketsScreen } from "@/features/settings/screens/tickets-screen";

export default function Route() {
  const router = useRouter();
  return (
    <TicketsScreen
      onVisit={(id) => router.push({ pathname: "/me/visit", params: { id } })}
      onGift={(id) => router.push({ pathname: "/me/gift", params: { id } })}
      onVoucher={(placeId, entry) => router.push({ pathname: "/me/credit", params: { placeId, entry } })}
      onEmpty={(tab) => {
        if (tab === "gifts") void Linking.openURL("https://mesita.ai/me/gift");
        else router.push(tab === "vouchers" ? "/search" : "/pay");
      }}
    />
  );
}
