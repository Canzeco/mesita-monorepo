// The flat address for the place's capabilities view — a resolver
// (lib/flat-address). It was `/settings` until MESITA-1841; that address now
// forwards here from next.config.ts.
import { resolvePlaceView } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatCapabilitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolvePlaceView("capabilities", await searchParams);
}
