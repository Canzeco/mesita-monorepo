// Products — THE CATALOGUE (MESITA-1869), and after MESITA-1872 it is exactly
// two things: the Mesita Partner banner, and the eight product cards.
//
// Pato, on the live page: *"remove thus shit. just leave the 8 boxes and the 1
// partnership box shit. payments log go into activity."*
//
// WHAT LEFT, AND WHY EACH ONE HAD TO. **Mesita Pay's Section** hung at the
// foot with its Stripe account and switch — a full box for ONE of the eight,
// on the page whose whole job is to let an operator compare all eight. It has
// its own address now (`products/pay`), reached from its own card, and
// Stripe's stored `?connect=` follows it there. **The Payments Soon strip**
// went to Activity, which is where an operator already reads what happened;
// what guests paid and what reached the account is a READING, not a product,
// and it was the only thing on this page that was not one.
//
// ── WHAT THE PAGE READS, AND WHY IT READS IT ──────────────────────────────
//
// Two reads now, and every card's state comes out of one of them:
//
//   the organization   `partnered` and `mesitaPayEnabled` — the two org-level
//                      columns. The subscription gates four cards; the Pay
//                      switch IS one.
//   its places         `business-web-list-places`, scope "org": the per-place
//                      columns (`pickupOrders`, `deliveryOrders`,
//                      `reservations`, `credits`) become the COUNT a card
//                      prints. This is the same payload the states matrix
//                      renders, so the two screens cannot disagree about a
//                      place.
//
// The Stripe read went with the box that needed it: two screens reading one
// account is how the console starts disagreeing with itself (MESITA-1847's
// badge lesson).
//
// A FAILED READ IS NOT A ZERO. If the places read throws, every per-place card
// drops its note rather than printing "On at 0 of 0 places" — a fabricated
// number is the one thing SoonStrip's law forbids outright, and zero is the
// most believable fabrication on this screen.
//
// ── WHERE A PRODUCT IS ACTUALLY TURNED ON ─────────────────────────────────
//
// Six of the eight are per-PLACE switches (Capabilities and Rewards), so the
// card's verb is a link into the place, not a switch here: an organization
// holding five places cannot turn Pickup Orders on for "the organization"
// because there is no such column. One place → straight into it. Several →
// the Places list, which is the chooser. None → Add place, the one next step
// (MESITA-1833's law that a row lands somewhere real).
//
// Mesita Pay is the exception, and the reason it is: it is an ORG switch on an
// ORG Stripe account, so its verb opens `products/pay`.
import { notFound, redirect } from "next/navigation";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductCatalog } from "@/components/console/ProductCatalog";
import {
  apiListConsolePlaces,
  apiListOrganizations,
  type ConsolePlace,
} from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import {
  orgHref,
  orgPayHref,
  orgPlacesHref,
  orgPlacesNewHref,
  placeHref,
} from "@/lib/console-routes";
import { buildProductCards } from "@/lib/products";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await props.params;
  const supabase = await createServerSupabase();
  const [user, organizations] = await Promise.all([
    getServerUser(),
    apiListOrganizations(supabase),
  ]);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId, "products"))}`);
  }
  const org = findOrg(organizations, orgId);
  if (!org) notFound();

  const isOwner = org.myRole === "owner";
  const partnered = org.partnered === true;

  // The places, for the per-place counts. NULL on failure, never an empty
  // array: the cards tell "we could not read this" and "nothing is on" apart,
  // and an empty array would collapse them into the second.
  let places: ConsolePlace[] | null = null;
  try {
    places = await apiListConsolePlaces(supabase, {
      scope: "org",
      organizationId: org.id,
    });
  } catch (e) {
    console.error("[products] business-web-list-places:", e);
  }

  // Where a per-place product is turned on. One place is the common case this
  // console is optimized for, so it skips the chooser entirely.
  const held = org.places;
  const placeHome =
    held.length === 1
      ? placeHref(held[0].id)
      : held.length > 1
        ? orgPlacesHref(org.id, "org")
        : orgPlacesNewHref(org.id);

  const products = buildProductCards({
    partnered,
    mesitaPayEnabled: org.mesitaPayEnabled === true,
    places,
    placeHome,
    noPlaces: held.length === 0,
    payHref: orgPayHref(org.id),
  });

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Mesita Products
        </h1>
        <p className="text-muted-foreground text-sm leading-snug">
          Enable products for {org.name}. Activate them at each place.
        </p>
      </div>

      {/* THE ONE BOX Pato kept: the partnership every gated card below is
          gated on. It ranks by depth — the full PartnerCard box while the
          organization is not a partner (a price, the owner's CTA, the perks,
          the modal), one line once it is. */}
      <PartnerBanner partnered={partnered} isOwner={isOwner} />

      <ProductCatalog products={products} />
    </>
  );
}
