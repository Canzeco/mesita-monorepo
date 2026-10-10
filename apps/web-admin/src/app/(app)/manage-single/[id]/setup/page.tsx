import { notFound } from "next/navigation";
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductCatalog } from "@/components/console/ProductCatalog";
import { PageErrorState } from "@/components/business/PageErrorState";
import { apiConsoleCatalog, type ConsolePlace } from "@/lib/api/console";
import { findPlace } from "@/lib/active-place";
import { placePageHref, placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { normalizePlacePlan } from "@/lib/plan-ladder";
import { buildProductCards } from "@/lib/products";
import { createServerSupabase } from "@/lib/supabase/server";

// Setup — the shop and the switchboard, business's page over the catalogue
// read admin can make (scope "all"; see the layout). The operator acts as
// the owner: every CTA below lands on an EF that lets a super-admin through.
export const dynamic = "force-dynamic";

export default async function AdminSetupPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ membership?: string }>;
}) {
  const { id } = await props.params;
  const { membership: membershipParam } = await props.searchParams;
  const supabase = await createServerSupabase();
  let place: ConsolePlace | null = null;
  let membershipPrice = null;
  let readFailed = false;
  try {
    const catalog = await apiConsoleCatalog(supabase);
    place = findPlace(catalog.places, id);
    membershipPrice = catalog.membershipPrice;
  } catch (e) {
    readFailed = true;
    console.error("[manage-single/setup] business-web-list-places:", e);
  }
  if (readFailed) {
    return (
      <PageErrorState
        heading="Couldn't load this place's setup"
        message="The catalogue reads what is already on. Reload to try again."
        retryHref={placePageHref(id, "setup")}
      />
    );
  }
  if (!place) notFound();
  const partnered = place.partnered === true;
  const products = buildProductCards({
    partnered,
    placePlan: normalizePlacePlan(place.plan),
    mesitaPayEnabled: place.mesitaPayEnabled === true,
    place,
    placeHref: (view: PlaceTab) => placeTabHref(id, view),
    payHref: placePayHref(id),
  });
  return (
    <>
      <p className="text-muted-foreground text-sm leading-snug">
        Everything {place.name} can turn on, and what each one costs.
      </p>
      <MembershipReturnNotice membership={membershipParam} />
      <PartnerBanner
        placeId={id}
        partnered={partnered}
        isOwner
        membership={place.membership ?? null}
        price={membershipPrice}
      />
      <ProductCatalog products={products} />
    </>
  );
}
