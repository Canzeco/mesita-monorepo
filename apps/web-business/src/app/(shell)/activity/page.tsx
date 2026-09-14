// The flat address for the place's activity view — a resolver (lib/flat-address).
import { resolvePlaceView } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolvePlaceView("activity", await searchParams);
}
