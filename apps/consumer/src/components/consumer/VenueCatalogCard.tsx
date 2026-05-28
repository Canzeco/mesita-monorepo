import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Clock,
  Gift,
  Globe,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";
import { CURRENT_USER } from "@/lib/consumer-data";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";

const TIER_PROPER: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

// Catalog row card — used by /saved and /discover/catalog.
//
// Body is a chip-strip layout that mirrors the swipe-card overlay so
// the two surfaces feel like the same product. Each meta value lives
// in a small neutral chip (bg-muted/60); the promo lives in a
// brand-pink chip pinned to the bottom of the card via mt-auto so it
// keeps its own row even when the chip-strip grows.

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
  const isPartner = venue.listing_type === "partner";
  const partnerLabel = isPartner ? "Verified partner" : "Web listed";
  const category = venue.category ?? null;
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

  // Promo chip — same mock framing as the swipe card.
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
        <h3 className="font-display text-[15px] leading-tight font-semibold tracking-tight">
          {venue.name}
        </h3>

        {/* Compact chip strip — same shape as the swipe overlay,
            re-toned for the light card surface (bg-muted/60 + muted
            text instead of bg-white/12 + white text). Wraps as many
            rows as the content needs. */}
        <div className="flex flex-wrap gap-1">
          <Chip>
            {isPartner ? (
              <BadgeCheck className="h-2.5 w-2.5 shrink-0 text-sky-600" />
            ) : (
              <Globe className="text-muted-foreground h-2.5 w-2.5 shrink-0" />
            )}
            <span>{partnerLabel}</span>
          </Chip>
          {category && (
            <Chip>
              <span className="capitalize">{category.toLowerCase()}</span>
            </Chip>
          )}
          {priceLevel && <Chip>{priceLevel}</Chip>}
          {ratingLabel && (
            <Chip>
              <Star className="h-2.5 w-2.5 shrink-0 fill-amber-400 text-amber-400" />
              <span className="text-foreground font-semibold">
                {ratingLabel}
              </span>
              {ratingCountLabel && (
                <span className="text-muted-foreground/80">
                  ({ratingCountLabel})
                </span>
              )}
            </Chip>
          )}
          {distanceLabel && (
            <Chip>
              <Navigation className="text-muted-foreground h-2.5 w-2.5 shrink-0" />
              <span>{distanceLabel}</span>
            </Chip>
          )}
          {zoneLabel && (
            <Chip>
              <MapPin className="text-muted-foreground h-2.5 w-2.5 shrink-0" />
              <span className="max-w-[110px] truncate">{zoneLabel}</span>
            </Chip>
          )}
          {statusLabel && (
            <Chip>
              <Clock
                className={cn(
                  "h-2.5 w-2.5 shrink-0",
                  isOpen ? "text-emerald-600" : "text-muted-foreground",
                )}
              />
              <span>{statusLabel}</span>
            </Chip>
          )}
        </div>

        {/* Promo pinned to the bottom of the card via mt-auto so it
            always reads as its own row, never tucked alongside the
            neutral chips. */}
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

// Neutral chip used by every meta value. Same shape as the swipe-card
// MetaChip, re-toned for the light card surface so the contrast on a
// white background still reads premium.
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-muted/70 ring-border/40 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap text-foreground/80 ring-1">
      {children}
    </span>
  );
}

// Compact "1.9K" / "1.2M" style for ratings counts.
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}
