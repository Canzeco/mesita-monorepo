// Products — THE CATALOGUE (MESITA-1869), and after MESITA-1872 it is exactly
// two things: the Mesita Partner banner, and the eight product cards.
//
// WHICH EIGHT CHANGED AGAIN IN MESITA-1900, the shape did not. MESITA-1884
// took Rewards OUT of the grid on Pato's *"should i separate visits and
// rewards into two?? i don't think so."*; his 2026-09-16 list puts it back and
// drops Terminal, so the count is eight in both eras and two cards swapped.
// The partnership stays a BANNER and never becomes a ninth card:
// *"(partnership, not a product but on top, special)"*.
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
// ── ONE SUBJECT, ONE READ (MESITA-1892) ───────────────────────────────────
//
// It was the ORGANIZATION's catalogue and it took two reads: the organization,
// for `partnered` and `mesitaPayEnabled`, and then its places, because the
// per-place columns (`pickupOrders`, `deliveryOrders`, `reservations`,
// `credits`) became the COUNT a card printed. Both facts are on one row now —
// `places.partnered`, `place_profiles.mesita_pay_enabled` and the four
// capability columns are the same record — so the page reads the viewer once
// and finds this place in it.
//
// THE COUNT BECAME A STATE, and that is the honest consequence of the layer
// going: "On at 2 of 5 places" was an aggregate over a holder that no longer
// exists. A card states whether the product is on HERE, which is what an
// operator on this place's page was ever going to act on.
//
// A FAILED READ IS NOT A ZERO. If the viewer read throws, the shell has
// already said so and this page renders its error rather than printing "Not
// enabled" about a record nobody managed to fetch — a fabricated state is the
// one thing SoonStrip's law forbids outright.
//
// ── WHERE A PRODUCT IS ACTUALLY TURNED ON ─────────────────────────────────
//
// Seven of the eight carry a verb into one of this place's own views, because
// that is where their switch is. Mesita Payments' SETUP — the Stripe account
// and the switch it unlocks — is the sub-step at `products/pay`; Customers is
// `soon`, so it carries no verb at all and its door is the rail row it already
// has.
import { notFound, redirect } from "next/navigation";
import { MembershipReturnNotice } from "@/components/console/MembershipReturnNotice";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { ProductCatalog } from "@/components/console/ProductCatalog";
import { PageErrorState } from "@/components/business/PageErrorState";
import { apiConsoleViewer, type ConsolePlace } from "@/lib/api/console";
import { findPlace } from "@/lib/active-place";
import { placePageHref, placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { buildProductCards } from "@/lib/products";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ membership?: string }>;
}) {
  const { id } = await props.params;
  const { membership: membershipParam } = await props.searchParams;
  const user = await getServerUser();
  if (!user) {
    redirect(`/signin?next=${encodeURIComponent(placePageHref(id, "products"))}`);
  }
  const supabase = await createServerSupabase();

  // The VIEWER, not just the list: the Membership's catalog price is a
  // console-wide fact and rides the envelope. It is the same request-cached
  // call the shell layout already paid for, so this costs no round trip.
  let place: ConsolePlace | null = null;
  let membershipPrice = null;
  let readFailed = false;
  try {
    const viewer = await apiConsoleViewer(supabase);
    place = findPlace(viewer.places, id);
    membershipPrice = viewer.membershipPrice;
  } catch (e) {
    readFailed = true;
    console.error("[products] business-web-list-places:", e);
  }

  if (readFailed) {
    return (
      <PageErrorState
        heading="Couldn't load this place's products"
        message="The catalogue reads what is already on. Reload to try again."
        retryHref={placePageHref(id, "products")}
      />
    );
  }
  // A place the caller holds no membership on has no catalogue to show, and
  // answering 404 here is the same answer the layout gives for an id that does
  // not exist — so the path is never an oracle.
  if (!place) notFound();

  const isOwner = place.myRole === "owner";
  const partnered = place.partnered === true;

  const products = buildProductCards({
    partnered,
    mesitaPayEnabled: place.mesitaPayEnabled === true,
    place,
    placeHref: (view: PlaceTab) => placeTabHref(id, view),
    payHref: placePayHref(id),
  });

  return (
    <>
      {/* NO `h1` OF ITS OWN (MESITA-1892). The place layout renders
          `PlaceHeading` above every page under `places/[id]`, and it names the
          venue and then the page — so a second title here would be the third
          time the screen says where you are. */}
      <p className="text-muted-foreground text-sm leading-snug">
        Everything {place.name} can turn on, and what each one costs.
      </p>

      {/* What Stripe Checkout sent them back with, above everything: the
          answer to "did that work" outranks the catalogue it came from. */}
      <MembershipReturnNotice membership={membershipParam} />

      {/* THE ONE BOX Pato kept: the partnership every gated card below is
          gated on. It ranks by depth — the full PartnerCard box while the
          place is not a partner (a price, the owner's CTA, the perks, the
          modal), one line once it is. */}
      <PartnerBanner
        placeId={id}
        partnered={partnered}
        isOwner={isOwner}
        membership={place.membership ?? null}
        price={membershipPrice}
      />

      <ProductCatalog products={products} />
    </>
  );
}
