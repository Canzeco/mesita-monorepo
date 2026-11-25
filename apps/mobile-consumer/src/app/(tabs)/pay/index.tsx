import { useRouter } from "expo-router";

import { useGate } from "@/features/auth";
import { PayScreen } from "@/features/pay/screens/pay-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  const router = useRouter();
  const { member } = useGate();
  return (
    <PayScreen
      signedIn={member}
      onSignIn={() => router.push("/sign-in")}
      onPlace={(id) => router.push({ pathname: "/place/[id]", params: { id } })}
      onCode={(id) => router.push({ pathname: "/pay/code", params: { placeId: id } })}
    />
  );
}
