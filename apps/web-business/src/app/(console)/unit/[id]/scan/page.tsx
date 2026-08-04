import { redirect } from "next/navigation";
import { placePath } from "@/lib/business-route-contract";

// Retired (MESITA-843): the business console has no scan and no check surface.
// Mesita Check is the whole staff surface — staff scan the guest's QR with any
// phone camera and work the public check page, so a check is worked there or
// nowhere. Kept as a redirect only so live links don't 404.
export default async function RetiredScanRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placePath(id));
}
