import { useRouter } from "expo-router";

import { ProfileScreen } from "@/features/identity/screens/profile-screen";

export default function Route() {
  const router = useRouter();
  return <ProfileScreen onSaved={() => router.back()} />;
}
