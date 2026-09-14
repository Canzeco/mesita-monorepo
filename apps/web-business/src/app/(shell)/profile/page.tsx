// The flat address for the place's profile view — a resolver (lib/flat-address).
import { resolvePlaceView } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolvePlaceView("profile", await searchParams);
}
