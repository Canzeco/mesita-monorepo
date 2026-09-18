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
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { HalfScope } from "@/components/shared/Half";
import { ProductPane } from "@/components/console/ProductPane";
import { PartnershipPane } from "@/components/console/PartnershipPane";
import { useHeldPlaceOrNull } from "@/components/console/PlaceScope";
import { buildProductCards } from "@/lib/products";
import { PARTNERSHIP_SLUG, productFromSlug } from "@/lib/product-routes";
import { placePayHref } from "@/lib/console-routes";
import { placeTabHref, type PlaceTab } from "@/lib/place-tabs";

export default function ActivityProductPage({
  params,
}: {
  params: Promise<{ product: string }>;
}) {
  const { product } = use(params);
  const place = useHeldPlaceOrNull();
  if (!place) return null;

  if (product === PARTNERSHIP_SLUG) {
    return <PartnershipPane place={place} half="activity" />;
  }

  const key = productFromSlug(product);
  if (!key) notFound();

  const card = buildProductCards({
    partnered: place.partnered,
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
  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/places/${encodeURIComponent(place.id)}/activity`}
        className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[13px] font-medium"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        All activity
      </Link>
      <HalfScope half="activity">
        <ProductPane card={card} />
      </HalfScope>
    </div>
  );
}
