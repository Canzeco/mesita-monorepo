import {
  Clock,
  Instagram,
  MapPin,
  Navigation,
  Star,
  Users,
} from "lucide-react";
import {
  cn,
  formatCompactCount,
  formatDistanceKm,
  formatRating,
} from "@/lib/utils";
import type { Place } from "@/lib/api/places";
import { resolveZoneLabel } from "@/lib/adapters/place-to-detail";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { getOpeningStatusLabel } from "@/lib/place-status";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { Spinner } from "@/components/shared";
import { PromoChip } from "./PromoChip";
import { PartnerMark } from "./PartnerMark";
import { isPartner } from "@/lib/promo-rates";

/** Place fields — padding comes from SWIPE_CARD_FIELDS_INNER on the card face. */
export function SwipeCardInfo({
  place,
  compact = false,
}: {
  place: Place;
  compact?: boolean;
}) {
  // decision: Pato — swipe uses $$$$ symbols; numeric amounts only on profile
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const ratingLabel = formatRating(place.google_rating);
  const ratingCountLabel =
    place.google_count != null ? formatCompactCount(place.google_count) : null;
  const distanceLabel = formatDistanceKm(place.distance_km);
  const zoneLabel = resolveZoneLabel({
    zone: place.zone,
    address: place.address,
  });
  const zoneDisplay = zoneLabel ?? "Neighborhood";
  const categoryLabel = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const igFollowersLabel =
    place.instagram_followers_count != null
      ? formatCompactCount(place.instagram_followers_count)
      : null;
  const statusLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
  // THE CARD STATES PARTNER, NOT VERIFIED (decision: Pato).
  //
  // It used to do neither cleanly: the disc beside the name was a component
  // called VerifiedCheck gated on `promoting`, and the chip below it read
  // "Not Verified" gated on `!promoting`. Two verification words over one
  // reward boolean, and neither fact was the one being read. Verification is
  // Mesita's own bookkeeping and is off the card entirely now.
  //
  // Partner is computed per request from the plan (see promo-rates.isPartner),
  // never `listing_type` — that enum fuses paying with strategy and goes stale
  // the moment a promo lane closes without the row being rewritten.
  const partner = isPartner(place);

  return (
    <div
      className={cn("flex flex-col", compact ? "gap-1.5" : "gap-2.5 p-4 pt-3")}
    >
      <h2
        className={cn(
          "inline-flex max-w-full min-w-0 items-center gap-1.5 leading-[1.15] font-semibold tracking-[-0.01em] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.62)]",
          compact ? "text-[1.3rem]" : "text-[1.95rem]",
        )}
      >
        <span className={cn("min-w-0", compact && "truncate")}>
          {place.name}
        </span>
        {partner && (
          <PartnerMark className="text-primary drop-shadow-media h-[18px] w-[18px] shrink-0" />
        )}
      </h2>

      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5",
          // Keep compact swipe overlays to: place name + up to 3 lines of tags.
          compact && "max-h-[102px] overflow-hidden",
        )}
      >
        {/* decision: Pato — newly created / still-enriching places show the
            Enriching chip on the swipe deck too (same signal as place detail
            + search add-row). Leads the tag row so the in-flight state is
            obvious before category / price / etc. */}
        {place.is_enriching && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-emerald-300/55 bg-emerald-500/35 font-semibold whitespace-nowrap text-emerald-50 backdrop-blur-md",
              compact ? "type-label px-[9px] py-[3px]" : "px-2.5 py-1 text-xs",
            )}
            aria-live="polite"
          >
            <Spinner
              size="sm"
              label="Enriching"
              className="h-3 w-3 border-emerald-200/40 border-t-emerald-100"
            />
            Enriching
          </span>
        )}
        {/* ALWAYS RENDERED, AND FIRST. Partner is a two-state fact, so
            showing the chip only in one state made its absence ambiguous —
            a guest could not tell "not a partner" from "the card ran out of
            room". Same glyph both ways, because the negative is the common
            case and a warning icon on most cards is noise, not information. */}
        <MetaChip compact={compact}>
          <span aria-hidden>{partner ? "🤝" : "🌐"}</span>
          <span className="font-semibold">
            {partner ? "Partner" : "Not Partner"}
          </span>
        </MetaChip>
        {categoryLabel && (
          <MetaChip compact={compact}>
            <span className="font-semibold">{categoryLabel}</span>
          </MetaChip>
        )}
        {priceLabel && (
          <MetaChip compact={compact}>
            <span className="font-semibold">{priceLabel}</span>
          </MetaChip>
        )}
        {ratingLabel && (
          <MetaChip compact={compact}>
            <span className="font-semibold">{ratingLabel}</span>
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            {ratingCountLabel && (
              <span className="text-white/70">({ratingCountLabel})</span>
            )}
          </MetaChip>
        )}
        {igFollowersLabel && (
          <MetaChip compact={compact}>
            <Instagram className="h-3 w-3 shrink-0 text-pink-200/80" />
            <span className="font-semibold">{igFollowersLabel}</span>
            <Users className="h-3 w-3 shrink-0 text-white/70" />
          </MetaChip>
        )}
        <MetaChip compact={compact}>
          <Navigation className="h-3 w-3 shrink-0 text-white/70" />
          <span className="font-semibold">{distanceLabel}</span>
        </MetaChip>
        <MetaChip compact={compact}>
          <MapPin className="h-3 w-3 shrink-0 text-white/70" />
          <span
            className={cn(
              "max-w-[180px] truncate font-semibold",
              !zoneLabel && "text-white/75",
            )}
          >
            {zoneDisplay}
          </span>
        </MetaChip>
        {statusLabel && (
          <MetaChip compact={compact}>
            <Clock
              className={cn(
                "h-3 w-3 shrink-0",
                isOpen ? "text-emerald-400" : "text-white/70",
              )}
            />
            <span className="font-semibold">{statusLabel}</span>
          </MetaChip>
        )}
        <PromoChip place={place} size="md" showWhenEmpty />
      </div>
    </div>
  );
}

function MetaChip({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-white/35 bg-black/60 whitespace-nowrap text-white tabular-nums [font-variant-numeric:tabular-nums_lining-nums] backdrop-blur-md",
        compact ? "type-label px-[9px] py-[3px]" : "px-2.5 py-1 text-xs",
      )}
    >
      {children}
    </span>
  );
}
