import { PayCodeScreen } from "@/components/consumer/pay/PayCodeScreen";
import { isRouteId } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /pay/code — the guest's one Mesita QR, and the bill the waiter sends to it
// (MESITA-4823). ?from=<placeId> only says what the guest gets there.
export default async function Page({ searchParams }: { searchParams: Promise<{ from?: string | string[] }> }) {
  const { from } = await searchParams;
  return <PayCodeScreen from={typeof from === "string" && isRouteId(from) ? from : null} />;
}
