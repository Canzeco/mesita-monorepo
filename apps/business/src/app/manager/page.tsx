import { redirect } from "next/navigation";

// /manager is the bare entry; the actual dashboard lives at /manager/home.
// Forwarding here means deep links to /manager and /manager?unit=<id> both
// end up at Home (the unit param survives the bounce).
export const dynamic = "force-dynamic";

export default async function ManagerIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const params = await searchParams;
  const unit = params.unit?.toString();
  redirect(unit ? `/manager/home?unit=${unit}` : "/manager/home");
}
