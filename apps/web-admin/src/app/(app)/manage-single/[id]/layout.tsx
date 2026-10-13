// Single Place › one place: admin's place surface (MESITA-2086; detached from
// the shared/place-console generator in MESITA-2115). This file is the seam:
// it resolves the place ONCE, mounts the shell, and draws admin's own strip of
// doors.
//
// ONE READ, SUPER-ADMIN ONLY. `getManagePlace` is admin-web-get-overview.
// That response is the place plus Family and Category already resolved,
// the category options, the tag catalog, and the field limits. Nothing
// on the profile page fetches again.
import { notFound } from "next/navigation";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { getManagePlace } from "@/lib/place-view";
import { FIRST_STAGE_TABS } from "./access";
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

  return (
    <div className="mx-auto w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-24 lg:px-8">
      <PlaceManageShell
        placeId={id}
        initialPlace={manage.place}
        initialProfile={manage.profile}
      >
        <div className="flex flex-col gap-4">
          <PlaceHeading
            name={manage.place.name}
            disabled={manage.place.listed === false}
          />
          <PlaceTabStrip placeId={id} tabs={FIRST_STAGE_TABS} />
          {children}
        </div>
      </PlaceManageShell>
    </div>
  );
}
