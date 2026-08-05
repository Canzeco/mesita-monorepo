import { redirect } from "next/navigation";
import { placePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy — place detail briefly had a dual path under /saved (Favorites-era).
// Canonical is /place/[id] (MESITA-899).
export default async function LegacySavedPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placePath(id));
}
