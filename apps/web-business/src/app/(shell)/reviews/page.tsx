// The flat address for the place's reviews view — a resolver (lib/flat-address).
import { resolvePlaceView } from "@/lib/flat-address";

export const dynamic = "force-dynamic";

export default async function FlatReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return resolvePlaceView("reviews", await searchParams);
}
