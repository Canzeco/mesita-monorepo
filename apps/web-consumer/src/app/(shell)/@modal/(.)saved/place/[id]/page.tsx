import { redirect } from "next/navigation";
import { placePath } from "@/lib/consumer-route-contract";

export const dynamic = "force-dynamic";

// Legacy intercept — soft-nav to /saved/place/[id] lands on the canonical
// /place/[id] hard route (which may then re-intercept as a modal).
export default async function LegacySavedPlaceModalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placePath(id));
}
