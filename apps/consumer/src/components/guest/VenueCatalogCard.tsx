import Image from "next/image";
import Link from "next/link";
import { PartnerBadge, RatePill } from "@/components/shared";
import type { Venue } from "@/lib/api/venues";

// Catalog row card — the row-style venue tile used by the guest /discover
// catalog page. Extracted so the manager Place preview can render the same
// surface without duplicating the visual chrome.

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
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
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
        </div>
      </div>
      <div className="p-3.5">
        <h3 className="font-display text-base leading-tight font-semibold tracking-tight">
          {venue.name}
        </h3>
        <p className="text-muted-foreground mt-1 truncate text-[11px]">
          {subtitle || venue.address || "—"}
        </p>
      </div>
    </>
  );

  const className =
    "block overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:shadow-md";

  if (href === null) {
    return <div className={className}>{inner}</div>;
  }
  return (
    <Link href={href ?? `/guest/venue/${venue.id}`} className={className}>
      {inner}
    </Link>
  );
}
