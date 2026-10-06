"use client";

// ONE PRODUCT'S ACTIVITY (MESITA-1986).
//
// The mirror of `setup/[product]`: `HalfScope half="activity"` renders the
// view's `Activity` half and drops its `Manage` half, so this is the address
// that holds the Bookings table, the visit log and the orders queue — the work
// Setup used to be showing.
//
// THE PARTNERSHIP HAS NO LOG, and says so rather than 404ing: it is a row on
// both indexes because it is a row in the list, and a row that refuses one of
// the two surfaces breaks the symmetry it is part of.
//
// A SLUG THAT IS NOT A PRODUCT 404s. `productFromSlug` returns null and
// `notFound()` refuses the address, so a typo never renders a generic pane.
import { use } from "react";
import { notFound } from "next/navigation";
import { HalfScope } from "@/components/shared/Half";
import { ProductPane } from "@/components/console/ProductPane";
import { FuturePane } from "@/components/console/FuturePane";
import { useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { buildProductCards } from "@/lib/products";
import { FUTURE_SLUG, productFromSlug } from "@/lib/product-routes";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";
import { hasHalf } from "@/lib/product-halves";

export default function ActivityProductPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product } = use(params);
  const place = useHeldPlaceOrNull();
  if (!place) return null;

  // FUTURE PRODUCTS — THE LAST SENTINEL (MESITA-2011). The Plan row was the
  // other one and is a product now, so this is the only slug left that
  // resolves before `productFromSlug` because it is deliberately not a
  // `ProductKey`.
  if (product === FUTURE_SLUG) {
    // THE WHOLE SUITE — see the twin in the products half (MESITA-1999).
    return (
      <FuturePane
        cards={buildProductCards({
          plan: place.plan,
          mesitaPayEnabled: place.pay === "enabled",
          place,
          placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
          payHref: placePayHref(place.id),
        })}
      />
    );
  }

  const key = productFromSlug(product);
  if (!key) notFound();

  // THE MAP IS THE ROUTER (MESITA-2004). A product that has no Activity half
  // has no Activity ADDRESS — `/activity/mesita-profile` 404s like any other
  // name off the contract, exactly as `PlaceTabGate` refuses a segment outside
  // `PLACE_TABS`.
  //
  // THIS IS WHAT KEEPS `PRODUCT_HALVES` HONEST. There is no test runner in this
  // package, so nothing can assert the map against the views; wiring it to the
  // router instead means a wrong entry is a 404 you meet on the first click
  // rather than a blank pane somebody finds in a month.
  //
  // IT ALSO CLOSES A LIVE BUG. Before this line, four products with a view and
  // no `Half` markers — Profile, Online Reputation, Digital Menu, Online Payments
  // — rendered their whole Setup screen at this address, because `ProductPane`
  // returned the view without reading `useHalf()`. Same screen, two addresses.
  if (!hasHalf(key, "activity")) notFound();

  const card = buildProductCards({
    plan: place.plan,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  }).find((c) => c.key === key);
  if (!card) notFound();

  // FULL WIDTH, WITH A WAY BACK (MESITA-1988). Activity has no index — it is
  // one screen — so this address is a deep link into one product's log rather
  // than a pane beside a column, and the only chrome it owes the reader is the
  // door back to the whole log.
  // NO "ALL ACTIVITY" LINK ANY MORE (MESITA-2004). It pointed at the place's
  // whole log, one level up, and it existed because the old two-column shell
  // put a 316px index beside the pane that below `lg` was a screen you had to
  // go back to. The menu is a column at every width now and Activity is a row
  // near the top of it, so this was the second door onto an address already on
  // screen — and the `Setup | Activity` pair in the pane header sits exactly
  // where it used to, which made the two read as one control.
  return (
    <div className="flex flex-col gap-4">
      <HalfScope half="activity">
        <ProductPane card={card} />
      </HalfScope>
    </div>
  );
}
