// Single Place › one place: admin's place surface (MESITA-2086). This file is
// the seam: it resolves the place ONCE, holds it for the views, and draws
// admin's strip of doors.
//
// ONE READ, SUPER-ADMIN ONLY. `getManagePlace` is admin-web-get-overview.
//
// THE PROFILE EDITOR IS IN THE BUSINESS APP (MESITA-3103): one editor, for
// owners and for Mesita staff. The heading's "Edit profile" opens it there.
import { notFound } from "next/navigation";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { getManagePlace } from "@/lib/place-view";
import { businessPlaceHref } from "@/lib/business-url";
import { FIRST_STAGE_TABS } from "./access";
import { PlaceStateShell } from "./PlaceStateShell";
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
    <div className="mx-auto flex h-full min-h-0 w-full flex-col px-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <PlaceStateShell initialPlace={manage.place} initialProfile={manage.profile}>
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 flex-col gap-4">
            <PlaceHeading
              name={manage.place.name}
              disabled={manage.place.listed === false}
              editHref={businessPlaceHref(id, "profile")}
            />
            <PlaceTabStrip placeId={id} tabs={FIRST_STAGE_TABS} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pb-8">{children}</div>
        </div>
      </PlaceStateShell>
    </div>
  );
}
