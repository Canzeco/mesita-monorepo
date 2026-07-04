import Image from "next/image";
import Link from "next/link";
import { Navigation, Star } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { PromoChip } from "./PromoChip";
import { placeHref } from "@/lib/place-route";

// Catalog row card — used by /saved and /discover/catalog.
//
// Deliberately minimal. The card is a 2-column grid tile, ~170px
// wide on a phone — cramming partner type + category + price +
// rating + distance + zone + opening status + promo into that
// footprint produces a wall of tiny chips. The full overview lives
// on the place detail page one tap away; here we keep three things:
//
//   1. Photo (vibe at a glance + bookmark on the saved tile)
//   2. Name + a single "category · price" line
//   3. Promo chip pinned to the bottom
//
// Anything else (rating, distance, zone, opening status) was visual
// noise at this scale; the saved tile reads as a scannable shortlist
// of places, not a stat sheet.

export function PlaceCatalogCard({
  place,
  href,
}: {
  place: Place;
  /** Defaults to the consumer detail page. Override (or pass null) to disable
   *  linking — useful for the business preview, which should be inert. */
  href?: string | null;
}) {
  const photo = place.photos[0];
  const category = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const priceLevel =
    place.price_level != null ? "$".repeat(place.price_level) : null;
  const ratingLabel =
    place.google_rating != null ? place.google_rating.toFixed(1) : null;
  const distanceLabel =
    place.distance_km != null ? `${place.distance_km} km` : null;
  const subtitleParts = [category, priceLevel].filter(Boolean) as string[];

  const inner = (
    <>
      <div className="bg-muted relative aspect-[4/3] w-full">
        {photo ? (
          <Image
            src={photo}
            alt={place.name}
            fill
            sizes="(max-width: 768px) 50vw, 256px"
            className="object-cover"
          />
        ) : (
          <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/70">
            <span className="font-display text-4xl font-bold tracking-tight">
              {place.name[0]?.toUpperCase() ?? "·"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-[15px] leading-tight font-semibold tracking-tight">
            {place.name}
          </h3>
          {(subtitleParts.length > 0 || ratingLabel || distanceLabel) && (
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-[11.5px]">
              {subtitleParts.length > 0 && (
                <span>{subtitleParts.join(" · ")}</span>
              )}
              {ratingLabel && (
                <span className="inline-flex items-center gap-1">
                  {subtitleParts.length > 0 && <span>·</span>}
                  <Star className="h-2.5 w-2.5 shrink-0 fill-amber-400 text-amber-400" />
                  <span>{ratingLabel}</span>
                </span>
              )}
              {distanceLabel && (
                <span className="inline-flex items-center gap-1">
                  {(subtitleParts.length > 0 || ratingLabel) && <span>·</span>}
                  <Navigation className="h-2.5 w-2.5 shrink-0" />
                  <span>{distanceLabel}</span>
                </span>
              )}
            </p>
          )}
        </div>

        <div className="mt-auto">
          <PromoChip place={place} size="sm" />
        </div>
      </div>
    </>
  );

  const className =
    "flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md";

  if (href === null) {
    return <div className={className}>{inner}</div>;
  }
  return (
    <Link href={href ?? placeHref(place.id, "explore")} className={className}>
      {inner}
    </Link>
  );
}
