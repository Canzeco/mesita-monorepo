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
import { PartnershipPane } from "@/components/console/PartnershipPane";
import { FuturePane } from "@/components/console/FuturePane";
import { useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { buildProductCards } from "@/lib/products";
import {
  FUTURE_SLUG,
  PARTNERSHIP_SLUG,
  PRODUCT_ORDER,
  productFromSlug,
} from "@/lib/product-routes";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";

export default function ProductsProductPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product } = use(params);
  const place = useHeldPlaceOrNull();
  if (!place) return null;

  if (product === PARTNERSHIP_SLUG) return <PartnershipPane place={place} />;

  // FUTURE PRODUCTS — a sentinel like the Plan row, resolved before
  // `productFromSlug` because it is deliberately not a `ProductKey`.
  if (product === FUTURE_SLUG) {
    const inTen = new Set<string>(PRODUCT_ORDER);
    return (
      <FuturePane
        cards={buildProductCards({
          plan: place.plan,
          mesitaPayEnabled: place.pay === "enabled",
          place,
          placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
          payHref: placePayHref(place.id),
        }).filter((c) => !inTen.has(c.key))}
      />
    );
  }

  const key = productFromSlug(product);
  if (!key) notFound();

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
