import { getIdentityCached } from "@/lib/identity";
import { PageHeader } from "@/components/shell/Page";
import { PageErrorState } from "@/components/ui/PageErrorState";
import { ClaimSearch } from "@/components/claim/ClaimSearch";
import { PlacesBoard } from "@/components/claim/PlacesBoard";
import { PLACES } from "@/lib/routes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Places" };

export default async function PlacesPage() {
  const identity = await getIdentityCached();
  if (!identity.ok) {
    return <PageErrorState heading="Could not load your places" message={identity.error} retryHref={PLACES} />;
  }
  const { places, isSuperAdmin } = identity.data;

  return (
    <>
      <PageHeader title="Places" sub="Selected is the place the menu works on. Yours are the places you run. All is every other place: find yours and claim it." />
      {/* Three boxes in two columns (Pato, MESITA-3151/3152): Selected over
          Yours on the left, All (the search, MESITA-3126) on the right. Everyone, staff included,
          claims a place before opening it (MESITA-3142). */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PlacesBoard places={places} isSuperAdmin={isSuperAdmin} />
        <ClaimSearch />
      </div>
    </>
  );
}
