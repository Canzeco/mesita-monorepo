import { PageContainer, PageHeader } from "@/components/PageContainer";
import { SinglePlaceClient } from "./SinglePlaceClient";

// Manage › Single Place — the picker. One box finds a place by Google Place
// ID or by name; a hit opens the place itself at /manage-single/<id>, which
// is the business console's place surface rendered here (MESITA-2086). An ID
// Mesita does not hold yet gets Create, and then opens the same way.
//
// The header lives on this page, not a layout: the place beneath
// `/manage-single/<id>` draws its own heading and must not sit under this one.
export const dynamic = "force-dynamic";

export default function ManageSinglePlacePage() {
  return (
    <PageContainer size="5xl" className="pb-16 sm:pb-24">
      <PageHeader
        eyebrow="Manage · Single Place"
        title="Single Place"
        description="One place at a time. A Google Place ID or a name finds it — on Mesita and on Google, where a place Mesita lacks is added from the list — and opens it: profile, setup, activity, every product view and the Admin box, the same screens the business console draws."
      />
      <div className="mt-6 sm:mt-8">
        <SinglePlaceClient />
      </div>
    </PageContainer>
  );
}
