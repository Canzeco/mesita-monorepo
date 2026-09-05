// Bare /places/[id] → the profile tab, org switch preserved.
import { redirect } from "next/navigation";
import { placePath, withOrg } from "@/lib/console-routes";
import { resolveOrgKey } from "@/lib/mock";

export default async function PlaceIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  redirect(withOrg(placePath(id, "profile"), resolveOrgKey(sp.org)));
}
