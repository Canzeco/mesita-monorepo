// The flat address for the organization's members page — a resolver
// (lib/flat-address).
import { resolveOrgPage } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatMembersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolveOrgPage("members", await searchParams);
}
