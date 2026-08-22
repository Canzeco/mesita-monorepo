import { redirect } from "next/navigation";
import { promosPath } from "@/lib/business-route-contract";

export const dynamic = "force-dynamic";

// Backward-compat: the old Promos page had subtabs (/promos/plan, /rates,
// /instagram, /guests). Promos v4 collapsed the page to a single two-box view,
// so any old tabbed deep link now redirects to the base Promos page.
export default async function BusinessPromosLegacyTabPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(promosPath(id));
}
