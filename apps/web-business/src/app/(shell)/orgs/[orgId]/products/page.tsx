// Products — THE CATALOGUE (MESITA-1869), and after MESITA-1872 it is exactly
// two things: the Mesita Partner banner, and the eight product cards.
//
// WHICH EIGHT CHANGED IN MESITA-1884, the shape did not. Pato: *"should i
// separate visits and rewards into two?? i don't think so."* Rewards left the
// grid — it is a dial inside Visits, not a thing anyone buys — and Customers
// took the slot. The partnership stays a BANNER and never becomes a ninth
// card: *"(partnership, not a product but on top, special)"*.
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
//                      switch IS one. Since MESITA-1877 the same payload also
//                      carries the live Membership (renewal date, dunning)
//                      and the catalog price, so the banner states WHEN it
//                      renews and what it costs without a second call.
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
// Five of the eight carry a verb into the PLACE (Capabilities and Rewards),
// because that is where their switch is: an organization holding five places
// cannot turn Pickup Orders on for "the organization" — there is no such
// column. One place → straight into it. Several → the Places list, which is
// the chooser. None → Add place, the one next step (MESITA-1833's law that a
// row lands somewhere real).
//
// The other three carry no place verb at all. Mesita Pay is an ORG switch on
// an ORG Stripe account, so its verb opens `products/pay`; Customers and
// Terminal are `soon`, so they carry no verb at all and their doors are the
// rail rows they already have.
import { notFound, redirect } from "next/navigation";
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductCatalog } from "@/components/console/ProductCatalog";
import {
  apiConsoleViewer,
  apiListConsolePlaces,
  type ConsolePlace,
} from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import {
  orgHref,
  orgPayHref,
  orgPlacesHref,
  orgPlacesNewHref,
} from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { buildProductCards } from "@/lib/products";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ membership?: string }>;
}) {
  const { orgId } = await props.params;
  const { membership: membershipParam } = await props.searchParams;
  const supabase = await createServerSupabase();
  // The VIEWER, not just the list: the Membership's catalog price is a
  // console-wide fact and rides the envelope. It is the same request-cached
  // call `apiListOrganizations` reads through, so this costs no round trip.
  const [user, viewer] = await Promise.all([
    getServerUser(),
    apiConsoleViewer(supabase),
  ]);
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(orgHref(orgId, "products"))}`);
  }
  const org = findOrg(viewer.organizations, orgId);
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

  // Where a per-place product is turned on. One place is the case this console
  // is built for, so it skips the chooser entirely and lands on the VIEW that
  // holds the switch — Capabilities or Rewards, per `PRODUCT_VIEW`. Those two
  // lost their rail rows in MESITA-1879, which makes this card the door.
  //
  // With several places there is no single view to name, so the verb opens the
  // list and the operator picks; with none it opens Add place, and `noPlaces`
  // makes every verb say so.
  const held = org.places;
  const placeLanding = (view: PlaceTab) =>
    held.length === 1
      ? placeTabHref(held[0].id, view)
      : held.length > 1
        ? orgPlacesHref(org.id, "org")
        : orgPlacesNewHref(org.id);

  const products = buildProductCards({
    partnered,
    mesitaPayEnabled: org.mesitaPayEnabled === true,
    places,
    placeHref: placeLanding,
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

      {/* What Stripe Checkout sent them back with, above everything: the
          answer to "did that work" outranks the catalogue it came from. */}
      <MembershipReturnNotice membership={membershipParam} />

      {/* THE ONE BOX Pato kept: the partnership every gated card below is
          gated on. It ranks by depth — the full PartnerCard box while the
          organization is not a partner (a price, the owner's CTA, the perks,
          the modal), one line once it is. */}
      <PartnerBanner
        orgId={org.id}
        partnered={partnered}
        isOwner={isOwner}
        membership={org.membership ?? null}
        price={viewer.membershipPrice}
      />

      <ProductCatalog products={products} />
    </>
  );
}
