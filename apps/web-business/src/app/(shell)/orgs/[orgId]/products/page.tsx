// Products — THE CATALOGUE (MESITA-1869).
//
// Pato, 2026-09-15, listing the organization's rows: *"Configuration (here
// have members shit) · Products (here have partner and all the products to
// activate, remember that profile is free) · Places · Costumers · Activity"*,
// with a mock of the grid.
//
// THIS PAGE REPLACES PAYMENTS, address and row. Payments was a page holding
// two Soon strips: what it was FOR — what guests paid, what reached the
// account — is a reading of a product that is not built, and the two things on
// it anybody could act on were setup boxes that had already moved to
// Configuration (MESITA-1852). Both of those are PRODUCTS, so they are here.
//
// ── WHAT THE PAGE READS, AND WHY IT READS IT ──────────────────────────────
//
// Three reads, and every card's state comes out of one of them:
//
//   the organization   `partnered` and `mesitaPayEnabled` — the two org-level
//                      columns. The subscription gates three cards; the Pay
//                      switch IS one.
//   its places         `business-web-list-places`, scope "org": the per-place
//                      columns (`pickupOrders`, `deliveryOrders`,
//                      `reservations`, `credits`, `mesitaPay`) become the
//                      COUNT a card prints. This is the same payload the
//                      states matrix renders, so the two screens cannot
//                      disagree about a place.
//   the Stripe account the Mesita Pay box below the grid, moved from
//                      Configuration with its `?connect=` notice.
//
// A FAILED READ IS NOT A ZERO. If the places read throws, every per-place card
// drops its note rather than printing "On at 0 of 0 places" — a fabricated
// number is the one thing SoonStrip's law forbids outright, and zero is the
// most believable fabrication on this screen. Same shape as the Stripe read's
// `accountError` below, which is the MESITA-1861 bug written down.
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
// ORG Stripe account, so its verb points at the box at the foot of this page.
import { notFound, redirect } from "next/navigation";
import { ConnectReturnNotice } from "@/components/console/ConnectReturnNotice";
import { MesitaPayCard } from "@/components/console/MesitaPayCard";
import { PartnerBanner } from "@/components/console/PartnerBanner";
import { PaymentsCard } from "@/components/console/PaymentsCard";
import { ProductCatalog } from "@/components/console/ProductCatalog";
import { SoonStrip } from "@/components/console/SoonStrip";
import { SOON_STRIPS } from "@/components/console/SoonStrips";
import { Section } from "@/components/shared/Section";
import {
  apiGetPaymentAccount,
  apiListConsolePlaces,
  apiListOrganizations,
  paymentAccountState,
  type ConsolePlace,
  type PaymentAccount,
} from "@/lib/api/organizations";
import { findOrg } from "@/lib/active-organization";
import {
  orgHref,
  orgPlacesHref,
  orgPlacesNewHref,
  placeHref,
} from "@/lib/console-routes";
import { buildProductCards } from "@/lib/products";
import { createServerSupabase, getServerUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ orgId }, sp] = await Promise.all([params, searchParams]);
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
  const connect = typeof sp.connect === "string" ? sp.connect : undefined;

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

  // The Stripe box's own read, moved here with the box (MESITA-1861's shape
  // kept exactly: the FLAG is what tells a blip from a genuine absence, and
  // without it a live account is offered a second one).
  let account: PaymentAccount | null = null;
  let orphaned = false;
  let accountError: string | null = null;
  try {
    ({ account, orphaned } = await apiGetPaymentAccount(supabase, org.id));
  } catch (e) {
    accountError = "Couldn't load the Stripe account.";
    console.error("[products] business-web-get-payment-account:", e);
  }

  const stripeReady =
    accountError === null &&
    account !== null &&
    account.charges_enabled === true &&
    account.details_submitted === true &&
    !orphaned;

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
    payHref: `${orgHref(org.id, "products")}#mesita-pay`,
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

      {/* Stripe's stored return lands on this page with the box it is about
          (MESITA-1869): the bare `/orgs/<id>` forwards `?connect=` here. */}
      <ConnectReturnNotice connect={connect} />

      <PartnerBanner partnered={partnered} isOwner={isOwner} />

      <ProductCatalog products={products} />

      {/* MESITA PAY'S OWN BOX, at the foot, and only once the organization can
          reach it. Not partnered, the card above already says "Needs Mesita
          Partner" and a second locked box would say it twice — the
          MESITA-1866/1867 composition survives, one tier down the page. */}
      {partnered && (
        <Section
          id="mesita-pay"
          lane
          title="Mesita Pay"
          description="Card payments inside Mesita, through the organization's own Stripe account."
        >
          <PaymentsCard
            orgId={org.id}
            account={account}
            orphaned={orphaned}
            isOwner={isOwner}
            loadError={accountError}
          />
          {/* ONE SEAM, inside one box (MESITA-1866): the account above, the
              switch it unlocks below. */}
          <div className="border-border/60 border-t pt-3">
            <MesitaPayCard
              partnered
              stripeReady={stripeReady}
              mesitaPayEnabled={org.mesitaPayEnabled === true}
              isOwner={isOwner}
              accountState={paymentAccountState(account, orphaned)}
              orphaned={orphaned}
              loadError={accountError}
            />
          </div>
        </Section>
      )}

      {/* What the catalogue cannot show yet: the money that moved through it.
          Honest about being unbuilt, and it sits UNDER the products rather
          than owning a row of its own (MESITA-1869 deleted that row). */}
      <SoonStrip {...SOON_STRIPS.payments} />
    </>
  );
}
