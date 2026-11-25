import { useRouter } from "expo-router";

import { AddPlaceScreen } from "@/features/place/screens/add-screen";

export default function Route() {
  const router = useRouter();
  return (
    <AddPlaceScreen
      onSignIn={() => router.push("/sign-in")}
      onCreated={(id) => router.replace({ pathname: "/place/[id]", params: { id } })}
    />
  );
}
