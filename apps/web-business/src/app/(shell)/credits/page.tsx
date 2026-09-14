// The flat address for the organization's credits page — a resolver
// (lib/flat-address). New in MESITA-1841.
import { resolveOrgPage } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatCreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolveOrgPage("credits", await searchParams);
}
