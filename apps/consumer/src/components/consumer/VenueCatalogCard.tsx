import Image from "next/image";
import Link from "next/link";
import { Gift, Star } from "lucide-react";
import { CURRENT_USER } from "@/lib/consumer-data";
import type { Venue } from "@/lib/api/venues";

const TIER_PROPER: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

// Catalog row card — used by /saved and /discover/catalog.
//
// Deliberately minimal. The card is a 2-column grid tile, ~170px
// wide on a phone — cramming partner type + category + price +
// rating + distance + zone + opening status + promo into that
// footprint produces a wall of tiny chips. The full overview lives
// on the venue detail page one tap away; here we keep three things:
//
//   1. Photo (vibe at a glance + bookmark on the saved tile)
//   2. Name + a single "category · price" line
//   3. Promo chip pinned to the bottom
//
// Anything else (rating, distance, zone, opening status) was visual
// noise at this scale; the saved tile reads as a scannable shortlist
// of places, not a stat sheet.

export function VenueCatalogCard({
  venue,
  href,
}: {
  venue: Venue;
  /** Defaults to the consumer detail page. Override (or pass null) to disable
   *  linking — useful for the business preview, which should be inert. */
  href?: string | null;
}) {
  const photo = venue.photos[0];
  const category = venue.category?.toLowerCase() ?? null;
  const priceLevel =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const ratingLabel =
    venue.google_rating != null ? venue.google_rating.toFixed(1) : null;
  const subtitleParts = [category, priceLevel].filter(Boolean) as string[];

  const promoPercent =
    venue.cashback_percent != null && venue.cashback_percent > 0
      ? venue.cashback_percent
      : 20;
  const isFirstVisit = venue.is_first_visit !== false;
  const promoKindLabel = isFirstVisit ? "welcome" : "return-visit";
  const tierLabel = TIER_PROPER[CURRENT_USER.tier] ?? "Mesita";
  const capPrefix = venue.currency === "MXN" ? "MX$" : "$";
  const capLabel =
    venue.reward_cap_mxn != null
      ? `Capped ${capPrefix}${venue.reward_cap_mxn.toLocaleString("en-US")} / visit`
      : null;

  const inner = (
    <>
      <div className="bg-muted relative aspect-[4/3] w-full">
        {photo ? (
          <Image
            src={photo}
            alt={venue.name}
            fill
            sizes="(max-width: 768px) 50vw, 256px"
            className="object-cover"
          />
        ) : (
          <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/70">
            <span className="font-display text-4xl font-bold tracking-tight">
              {venue.name[0]?.toUpperCase() ?? "·"}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-display text-[15px] leading-tight font-semibold tracking-tight">
            {venue.name}
          </h3>
          {(subtitleParts.length > 0 || ratingLabel) && (
            <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-[11.5px]">
              {subtitleParts.length > 0 && (
                <span className="capitalize">{subtitleParts.join(" · ")}</span>
              )}
              {ratingLabel && (
                <span className="inline-flex items-center gap-1">
                  {subtitleParts.length > 0 && <span>·</span>}
                  <Star className="h-2.5 w-2.5 shrink-0 fill-amber-400 text-amber-400" />
                  <span>{ratingLabel}</span>
                </span>
              )}
            </p>
          )}
        </div>

        <div className="mt-auto">
          <span
            className="bg-pink-gradient shadow-glow inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] whitespace-nowrap text-white"
            title={
              capLabel
                ? `at Mesita ${tierLabel} · ${capLabel}`
                : `at Mesita ${tierLabel}`
            }
          >
            <Gift className="h-2.5 w-2.5 shrink-0" strokeWidth={2.25} />
            <span className="font-semibold">
              {promoPercent}% OFF {promoKindLabel}
            </span>
            <span className="text-[8.5px] font-bold tracking-[0.14em] uppercase text-white/70">
              · mock
            </span>
          </span>
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
    <Link href={href ?? `/venues/${venue.id}`} className={className}>
      {inner}
    </Link>
  );
}
