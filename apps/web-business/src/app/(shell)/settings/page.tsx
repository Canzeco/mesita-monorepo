// The flat address for the place's settings view — a resolver (lib/flat-address).
import { resolvePlaceView } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolvePlaceView("settings", await searchParams);
}
