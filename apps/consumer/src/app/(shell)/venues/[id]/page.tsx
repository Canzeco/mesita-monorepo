import { redirect } from "next/navigation";
import { placeHref } from "@/lib/place-route";

// Legacy /venues/[id] → canonical /place/[id].
export default async function VenuesLegacyRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placeHref(id));
}
