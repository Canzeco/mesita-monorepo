"use client";

// ONE PRODUCT'S SETUP (MESITA-1986).
//
// Pato: *"for all the pages, this is just the fucking setup, not notifications
// activity, that goes in activity."*
//
// `HalfScope half="products"` is what enforces that: the view under it renders its
// `Manage` half and drops its `Activity` half, so the Bookings table that used
// to sit on Products → Online Reservations is on Activity → Online Reservations,
// which is the address that promises it.
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

export default function ProductsProductPage({
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
    // THE WHOLE SUITE, not the nine outside the ten (MESITA-1999). The pane
    // is a catalogue now and splits itself on BUILT; filtering here would
    // hand it a list already cut on the rail's axis and silently drop the ten
    // from a screen whose heading promises everything.
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

  // THE MAP IS THE ROUTER, ON THIS SIDE TOO (MESITA-2004). A product with no
  // Setup half has no Setup ADDRESS. Today that is Prepaid Credits alone —
  // MESITA-2003 moved every block on its view inside the Activity half, so
  // `/products/prepaid-credits` would render a heading over nothing.
  //
  // The symmetry with the Activity twin is the point: one map, two routes, and
  // neither can serve a half the product does not have.
  if (!hasHalf(key, "products")) notFound();

  const card = buildProductCards({
    plan: place.plan,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  }).find((c) => c.key === key);
  if (!card) notFound();

  return (
    <HalfScope half="products">
      <ProductPane card={card} />
    </HalfScope>
  );
}
