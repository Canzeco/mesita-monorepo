// The flat address for the place's rewards view — a resolver
// (lib/flat-address). New in MESITA-1841, with the view it points at.
import { resolvePlaceView } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatRewardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolvePlaceView("rewards", await searchParams);
}
