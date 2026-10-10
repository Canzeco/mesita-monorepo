// Single Place › one place: admin's place surface (MESITA-2086; detached from
// the shared/place-console generator in MESITA-2115). This file is the seam:
// it resolves the place ONCE, publishes the scope, mounts the shell, and draws
// admin's own strip of doors.
//
// ONE READ, SUPER-ADMIN ONLY. `getManagePlace` is admin-web-get-overview,
// which answers any place id for a super-admin; it is the AdminPlace every
// section edits, and it carries the heading's Listed fact (derived off
// `places.state` by the same helper the catalogue uses).
//
// The second read is gone (MESITA-2090). The layout used to list the WHOLE
// catalogue through the business console's list-places (scope "all") to find
// this one place's row, for the heading's Listed fact — which the overview
// already ships — and for a rail-scope context nothing read any more.
import { notFound } from "next/navigation";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PlaceScopeProvider } from "@/components/console/PlaceScope";
import { PlaceTabGate } from "@/components/console/PlaceTabGate";
import { getManagePlace } from "@/lib/place-view";
import { adminPlaceTabs } from "./access";
import { PlaceManageShell } from "./PlaceManageShell";
import { PlaceTabStrip } from "./PlaceTabStrip";

export const dynamic = "force-dynamic";

export default async function AdminPlaceLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = await params;
  const manage = await getManagePlace(id);
  if (!manage) notFound();

  const tabs = adminPlaceTabs();
  const scope = { placeId: id, tabs, held: true };

  return (
    <div className="mx-auto w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-24 lg:px-8">
      <PlaceScopeProvider value={scope}>
        <PlaceTabGate />
        <PlaceManageShell placeId={id} initialPlace={manage.place}>
          <div className="flex flex-col gap-4">
            <PlaceHeading
              name={manage.place.name}
              listed={manage.place.listed === true}
            />
            <PlaceTabStrip placeId={id} tabs={tabs} />
            {children}
          </div>
        </PlaceManageShell>
      </PlaceScopeProvider>
    </div>
  );
}
