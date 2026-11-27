import { useRouter } from "expo-router";

import { CardScreen } from "@/features/settings/screens/card-screen";

export default function Route() {
  const router = useRouter();
  return <CardScreen onOpen={(id) => router.push({ pathname: "/me/saved-card", params: { id } })} />;
}
