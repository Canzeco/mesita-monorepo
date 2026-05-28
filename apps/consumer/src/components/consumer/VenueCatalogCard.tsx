import Image from "next/image";
import Link from "next/link";
import {
  Clock,
  Gift,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";
import { PartnerBadge } from "@/components/shared";
import { CURRENT_USER } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";

const TIER_PROPER: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

// Catalog row card — the row-style venue tile used by:
//   - /saved (My Saved Places)
//   - /discover/catalog
//
// Layout mirrors the swipe-card overlay condensed for a 2-column
// grid: partner badge + bookmark on the photo, then a tight body
// with name, identity row (category · price · rating), location row
// (distance · zone), opening status, and the mock promo chip
// pinned to the bottom of the card.
//
// Address is intentionally NOT rendered here — the Notion Components
// table marks G-Catalog-V=NO for the address field. Photo overlays
// drop the cashback rate pill (the promo chip in the body now
// carries that signal — duplicating it on the photo competed for
// attention without adding information).

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
  const ratingCountLabel =
    venue.google_count != null ? formatCount(venue.google_count) : null;
  const distanceLabel =
    venue.distance_km != null ? `${venue.distance_km} km` : null;
  const zoneLabel = venue.zone ?? null;
  const statusLabel = (() => {
    if (venue.open_now === true && venue.closes_at) {
      return `Open · until ${venue.closes_at}`;
    }
    if (venue.open_now === false && venue.opens_at) {
      return `Closed · opens ${venue.opens_at}`;
    }
    if (venue.closes_at) return `Until ${venue.closes_at}`;
    return null;
  })();
  const isOpen = venue.open_now === true;

  const identityParts = [category, priceLevel].filter(Boolean) as string[];
  const locationParts = [distanceLabel, zoneLabel].filter(Boolean) as string[];

  // Promo chip mocks the per-tier welcome / return-visit reward until
  // the EF lands. Mirrors the swipe card.
  const promoPercent =
    venue.cashback_percent != null && venue.cashback_percent > 0
      ? venue.cashback_percent
      : 20;
  const isFirstVisit = venue.is_first_visit !== false;
  const promoKindLabel = isFirstVisit
    ? "welcome discount"
    : "return-visit discount";
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
        <div className="absolute top-2 left-2 flex flex-wrap items-center gap-1.5">
          <PartnerBadge listingType={venue.listing_type} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <h3 className="font-display text-base leading-tight font-semibold tracking-tight">
          {venue.name}
        </h3>

        {/* Identity row — category · price · rating. Rating renders
            with one decimal (`.toFixed(1)`) so it can't visually be
            mistaken for the integer rating count. */}
        {(identityParts.length > 0 || ratingLabel) && (
          <p className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 text-[11px]">
            {identityParts.length > 0 && (
              <span className="capitalize">
                {identityParts.join(" · ")}
              </span>
            )}
            {ratingLabel && (
              <span className="inline-flex items-center gap-1">
                {identityParts.length > 0 && <span>·</span>}
                <Star className="h-2.5 w-2.5 shrink-0 fill-amber-400 text-amber-400" />
                <span className="text-foreground font-semibold">
                  {ratingLabel}
                </span>
                {ratingCountLabel && (
                  <span className="text-muted-foreground/70">
                    ({ratingCountLabel})
                  </span>
                )}
              </span>
            )}
          </p>
        )}

        {locationParts.length > 0 && (
          <p className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
            {distanceLabel && (
              <>
                <Navigation className="h-2.5 w-2.5 shrink-0" />
                <span className="font-medium">{distanceLabel}</span>
              </>
            )}
            {distanceLabel && zoneLabel && <span>·</span>}
            {zoneLabel && (
              <>
                <MapPin className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{zoneLabel}</span>
              </>
            )}
          </p>
        )}

        {statusLabel && (
          <p className="text-muted-foreground inline-flex items-center gap-1 text-[11px]">
            <Clock
              className={cn(
                "h-2.5 w-2.5 shrink-0",
                isOpen ? "text-emerald-600" : "text-muted-foreground",
              )}
            />
            <span className="font-medium">{statusLabel}</span>
          </p>
        )}

        <div className="mt-1.5">
          <span
            className="bg-pink-gradient shadow-glow inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] whitespace-nowrap text-white"
            title={
              capLabel
                ? `at Mesita ${tierLabel} · ${capLabel}`
                : `at Mesita ${tierLabel}`
            }
          >
            <Gift className="h-2.5 w-2.5 shrink-0" strokeWidth={2.25} />
            <span className="truncate font-semibold">
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

// Compact "1.9K" / "1.2M" style for ratings counts.
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}
