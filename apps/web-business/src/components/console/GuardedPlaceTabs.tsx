"use client";

// PlaceTabs, wired to the unsaved-changes guard.
//
// This exists as its own four-line component so PlaceTabs itself never imports
// PlaceContext: the pool branch renders the bare PlaceTabs, and
// `usePlaceContext` throws where no provider exists.
//
// Fixes a shipped bug. `guardNav` is used for cross-tab links INSIDE sections
// (place-manage/ui.tsx CrossTabLink) but the tab row was a bare <Link>, so
// typing into a Profile field and clicking "Capabilities" discarded the edit
// silently — while the identical navigation from a link one card down stopped
// and asked. Admin routes its tab links through the guard; the #1508 port
// dropped that one wire.

import { usePlaceContext } from "@/components/place-manage/PlaceContext";
import { PlaceTabs } from "@/components/console/PlaceTabs";
import type { PlaceTab } from "@/lib/place-tabs";

export function GuardedPlaceTabs({
  placeId,
  tabs,
  organizationId,
}: {
  placeId: string;
  tabs: PlaceTab[];
  organizationId: string | null;
}) {
  const { guardNav } = usePlaceContext();
  return (
    <PlaceTabs
      placeId={placeId}
      tabs={tabs}
      organizationId={organizationId}
      onNavigate={(href, e) => guardNav(href, e)}
    />
  );
}
