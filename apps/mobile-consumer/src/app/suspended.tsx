import { SuspendedScreen } from "@/features/auth/screens/suspended-screen";

export { RouteError as ErrorBoundary } from "@/features/auth";

export default function Route() {
  return <SuspendedScreen />;
}
