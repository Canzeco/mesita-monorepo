import { redirect } from "next/navigation";
import { isRouteId, payCodePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// /pay/place/<placeId> — an old door (printed table QRs, sent links). The
// waiter leads now (MESITA-4823): it opens the guest's QR.
export default async function Page({ params }: { params: Promise<{ placeId: string }> }) {
  const { placeId } = await params;
  redirect(payCodePath(isRouteId(placeId) ? placeId : null));
}
