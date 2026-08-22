import { redirect } from "next/navigation";
import { placePath } from "@/lib/business-route-contract";

// Retired with the console's check surface (MESITA-843) — used to redirect to
// /scan, which is itself retired now.
export default async function RetiredTicketsRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(placePath(id));
}
