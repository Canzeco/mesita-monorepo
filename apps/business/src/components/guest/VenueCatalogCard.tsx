import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { PartnerBadge, RatePill } from "@/components/shared";
import type { Venue } from "@/lib/api/venues";

// Catalog row card — the row-style venue tile used by the guest /discover
// catalog page. Field set is driven by the Notion Components table's
// G-Catalog-V column: Media, Category, Name, Price Level, Time to close,
// Reward (Offers + Amount + Type), New. Address is intentionally NOT
// rendered here — the table marks it G-Catalog-V=NO.

// Match the 30-day window used by the swipe card so "New" reads
// consistently across discovery surfaces.
const NEW_BADGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const NEW_BADGE_THRESHOLD = Date.now() - NEW_BADGE_WINDOW_MS;

export function VenueCatalogCard({
  venue,
  href,
}: {
  venue: Venue;
  /** Defaults to the guest detail page. Override (or pass null) to disable
   *  linking — useful for the manager preview, which should be inert. */
  href?: string | null;
}) {
  const photo = venue.photos[0];
  const subtitle = [venue.vibe, venue.category]
    .filter(Boolean)
    .join(" · ")
    .toLowerCase();
  const isNew =
    !!venue.created_at && Date.parse(venue.created_at) > NEW_BADGE_THRESHOLD;
  const priceLevel =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const meta = [priceLevel, venue.closes_at ? `until ${venue.closes_at}` : null]
    .filter(Boolean)
    .join(" · ");

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
          {venue.listing_type === "partner" &&
            venue.cashback_percent != null &&
            venue.cashback_percent > 0 && (
              <RatePill
                percent={venue.cashback_percent}
                mechanic={
                  venue.fiscal_type === "informal" ? "discount" : "cashback"
                }
              />
            )}
          {isNew && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[9px] font-bold tracking-wider text-zinc-900 uppercase shadow-sm">
              <Star className="h-2.5 w-2.5" />
              New
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1 p-3.5">
        <h3 className="font-display text-base leading-tight font-semibold tracking-tight">
          {venue.name}
        </h3>
        {subtitle && (
          <p className="text-muted-foreground truncate text-[11px]">
            {subtitle}
          </p>
        )}
        {meta && (
          <p className="text-muted-foreground/80 text-[11px] font-medium">
            {meta}
          </p>
        )}
      </div>
    </>
  );

  const className =
    "block overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md";

  if (href === null) {
    return <div className={className}>{inner}</div>;
  }
  return (
    <Link href={href ?? `/venues/${venue.id}`} className={className}>
      {inner}
    </Link>
  );
}
