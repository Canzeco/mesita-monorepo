import { PageContainer, PageHeader } from "@/components/PageContainer";
import { getAtlasSettings } from "../enricher-config/actions";
import { getDiscoveryConfig } from "../filters-config/actions";
import { DEFAULT_NAME_ADMIN } from "../filters-config/catalog";
import { SinglePlaceClient } from "./SinglePlaceClient";

// Manage › Single Place — the picker. One box finds a place by Google Place
// ID or by name; a hit opens the place itself at /manage-single/<id>, which
// is the Single Place editor rendered here (MESITA-2086). An ID
// Mesita does not hold yet gets Create, and then opens the same way. With
// Creation › "Create the profile on open · admin app" on, a Google-only
// row's name creates and opens it too (MESITA-2298); the EF re-checks the
// switch, so this seed only decides the affordance.
//
// The header lives on this page, not a layout: the place beneath
// `/manage-single/<id>` draws its own heading and must not sit under this one.
export const dynamic = "force-dynamic";

export default async function ManageSinglePlacePage() {
  const [settings, discovery] = await Promise.all([
    getAtlasSettings(),
    getDiscoveryConfig(),
  ]);
  // Discovery › Word by Admin (MESITA-2322); a failed read keeps Find's
  // defaults, which are its behaviour before the knobs existed.
  const find = discovery.ok ? discovery.config.name.admin : DEFAULT_NAME_ADMIN;
  const createOnOpen = settings.ok
    ? settings.data.atlasCreateOnOpenAdmin !== false
    : true;
  return (
    <PageContainer size="full" className="pb-16 sm:pb-24">
      <PageHeader
        eyebrow="Manage · Single Place"
        title="Single Place"
        description="Every place Mesita holds. Press Enter to search."
      />
      <div className="mt-6 sm:mt-8">
        <SinglePlaceClient createOnOpen={createOnOpen} find={find} />
      </div>
    </PageContainer>
  );
}
