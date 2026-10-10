// Single Place › one place: THE BUSINESS CONSOLE'S PLACE SURFACE, rendered by
// admin (MESITA-2086; Pato: "import the functionalities of the business app
// to manage single page"). Every section, card and action below this layout
// is generated from shared/place-console — the same source web-business
// renders at /places/[id] — and this file is the admin seam: it resolves the
// place ONCE the way business's layout does, publishes the scope, mounts the
// shell, and draws admin's own strip of doors instead of a rail.
//
// TWO READS, BOTH SUPER-ADMIN-SAFE. `getManagePlace` is business-web-get-
// overview, whose super-admin branch answers for any place id, member or not;
// it is the AdminPlace every section edits. `apiConsoleCatalog` is
// business-web-list-places with scope "all", the one scope that ships a
// super-admin every place with every fact — it is where the heading's
// Listed fact comes from.
// business-web-get-place is NOT read: it 404s a held place to a non-member,
// and the operator is a member of nothing.
//
// A FAILED CATALOGUE READ DEGRADES, NEVER 404s: the place still opens on the
// AdminPlace alone, with the heading chips off and the rail row absent (the
// shared sections treat an absent row as "unknown", never "off").
import { notFound } from "next/navigation";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { PlaceScopeProvider } from "@/components/console/PlaceScope";
import { PlaceTabGate } from "@/components/console/PlaceTabGate";
import { RailScopeProvider } from "@/components/console/RailScopeContext";
import { findPlace } from "@/lib/active-place";
import { apiConsoleCatalog, type ConsolePlace } from "@/lib/api/console";
import { getManagePlace } from "@/lib/place-view";
import { createServerSupabase } from "@/lib/supabase/server";
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
  const supabase = await createServerSupabase();
  const [manage, catalog] = await Promise.all([
    getManagePlace(id),
    apiConsoleCatalog(supabase).catch((err: unknown) => {
      console.error("[manage-single] business-web-list-places:", err);
      return null;
    }),
  ]);
  if (!manage) notFound();

  // The place's own catalogue row, with the operator cast as its owner: the
  // shared sections gate owner-only doors on `myRole`, and the EFs behind
  // those doors already let a super-admin through.
  const row = catalog ? findPlace(catalog.places, id) : null;
  const railPlace: ConsolePlace | null = row ? { ...row, myRole: "owner" } : null;

  const tabs = adminPlaceTabs();
  const scope = { placeId: id, tabs, held: true, view: null };

  return (
    <div className="mx-auto w-full px-4 pt-6 pb-16 sm:px-6 sm:pt-8 sm:pb-24 lg:px-8">
      <RailScopeProvider
        value={{ places: railPlace ? [railPlace] : [], isSuperAdmin: true }}
      >
        <PlaceScopeProvider value={scope}>
          <PlaceTabGate />
          <PlaceManageShell placeId={id} initialPlace={manage.place}>
            <div className="flex flex-col gap-4">
              <PlaceHeading
                name={manage.place.name}
                listed={row?.listed ?? manage.place.listed === true}
              />
              <PlaceTabStrip placeId={id} tabs={tabs} />
              {children}
            </div>
          </PlaceManageShell>
        </PlaceScopeProvider>
      </RailScopeProvider>
    </div>
  );
}
