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
import { VerifiedCheck } from "./VerifiedCheck";
import { isPromoting } from "@/lib/promo-rates";

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
  // decision: Pato (MESITA-933) — verified = blue check disc beside name;
  // unverified = no disc, a "Not Verified" chip in the row instead. That chip
  // is a MetaChip like every other fact on the card (MESITA-1146): it was
  // hand-rolled as a solid black slab with no icon, which read as a different
  // KIND of thing rather than one more fact about the place.
  const promoting = isPromoting(place);

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
        {promoting && (
          <VerifiedCheck className="drop-shadow-media h-[18px] w-[18px] shrink-0" />
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
        {!promoting && (
          <MetaChip compact={compact}>
            {/* The globe matches the place-detail twin, which renders this
                same state through ProfileMetaChip with a lucide Globe — both
                surfaces mean "a plain web listing, not a Mesita partner", so
                both say it the same way. NOT a warning glyph: most places
                run no reward, so this chip is on MOST cards, and alarming the
                default state is noise rather than information. */}
            <span aria-hidden>🌐</span>
            <span className="font-semibold">Not Verified</span>
          </MetaChip>
        )}
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
