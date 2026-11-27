import { useRouter } from "expo-router";

import { ClassScreen } from "@/features/settings/screens/class-screen";

export default function Route() {
  const router = useRouter();
  return (
    <ClassScreen
      nav={{
        onInstagram: () => router.push("/me/vip-instagram"),
        onCode: () => router.push("/me/vip-code"),
        onAgency: () => router.push("/me/vip-agency"),
      }}
    />
  );
}
