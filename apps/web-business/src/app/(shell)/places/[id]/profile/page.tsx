// Profile — the listing a guest sees, editable. The console body ports
// verbatim; only its chrome changes: no mx-auto max-w-lg (the shell's 4xl
// container is the page now), and its sub-tabs ride ?tab= so the place
// route keeps ONE optional path segment (autoplan D6/D7).
import { PageErrorState } from "@/components/business/PageErrorState";
import { getPlaceOverview } from "@/lib/api/place";
import { resolvePlaceTab } from "@/lib/business-route-contract";
import { errMsg } from "@/lib/utils";
import { EditPlaceForm } from "@/app/(console)/place/[id]/place/EditPlaceForm";
import { assertActiveIsRoute, requireTab } from "../tab-guard";

export const dynamic = "force-dynamic";

export default async function PlaceProfileTab({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireTab(id, "profile");
  const tab = resolvePlaceTab(sp.tab ?? null) ?? "preview";

  let overview: Awaited<ReturnType<typeof getPlaceOverview>> | null = null;
  try {
    overview = await getPlaceOverview(supabase, id);
  } catch (err) {
    return (
      <PageErrorState
        heading="Couldn't load this place"
        message={errMsg(err, "Could not load your places.")}
        retryHref={`/places/${id}/profile`}
      />
    );
  }

  assertActiveIsRoute(overview?.active?.place?.id, id);
  const place = overview!.active!.place;

  return <EditPlaceForm place={place} tab={tab} basePath={`/places/${id}/profile`} />;
}
