"use client";

// PRODUCTS, WITH NOTHING OPEN (MESITA-1986).
//
// The index is the layout's; this is only the pane beside it. On a phone it is
// the whole screen, and the index is what you see instead — `ProductShell`
// hides one of the two below `lg`.
//
// THE DEFAULT PANE IS MESITA PARTNER, because it is the one thing five other
// products sit behind. Half a screen holding an empty state on arrival is half
// a screen teaching you that it is usually empty. It is a product now
// (MESITA-2011) and the second row rather than the first, which changes what
// the pane is CALLED and not why it is the one that opens.
//
// IT IS THE PRODUCT PAGE'S OWN COMPOSITION NOW (MESITA-2012), not a second
// spelling of it. This file used to mount the pane component directly, which
// was harmless while that pane drew its own header — and became a bare strip
// the moment MESITA-2012 cut the billing out of it and left the header to
// `ProductPane`. Building the card and mounting `ProductPane` inside a
// `HalfScope` is exactly what `products/[product]/page.tsx` does for this
// slug, so the default pane and the opened product cannot drift.
import { HalfScope } from "@/components/shared/Half";
import { ProductPane } from "@/components/console/ProductPane";
import { useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { buildProductCards } from "@/lib/products";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";

export default function ProductsPage() {
  const place = useHeldPlaceOrNull();
  if (!place) return null;

  const card = buildProductCards({
    plan: place.plan,
    mesitaPayEnabled: place.pay === "enabled",
    place,
    placeHref: (view: PlaceTab) => placeTabHref(place.id, view),
    payHref: placePayHref(place.id),
  }).find((c) => c.key === "partner");
  // THE SUITE IS A CONSTANT, so this can only be null if `SPECS` lost the
  // key — a null pane beats a crash on an index nobody navigated to.
  if (!card) return null;

  return (
    <HalfScope half="products">
      <ProductPane card={card} />
    </HalfScope>
  );
}
