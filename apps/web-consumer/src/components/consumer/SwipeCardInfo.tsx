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
import { getOpeningStateLabel } from "@/lib/place-state";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { Spinner } from "@/components/shared";

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
  const stateLabel = getOpeningStateLabel(place);
  const isOpen = place.open_now === true;

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
              "border-border bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-md border font-semibold whitespace-nowrap backdrop-blur-md",
              compact ? "type-label px-[9px] py-[3px]" : "px-2.5 py-1 text-xs",
            )}
            aria-live="polite"
          >
            <Spinner
              size="sm"
              label="Enriching"
              className="border-border h-3 w-3 border-t-emerald-100"
            />
            Enriching
          </span>
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
            <Star className="fill-foreground text-muted-foreground h-3 w-3 shrink-0" />
            {ratingCountLabel && (
              <span className="text-white/70">({ratingCountLabel})</span>
            )}
          </MetaChip>
        )}
        {igFollowersLabel && (
          <MetaChip compact={compact}>
            <Instagram className="text-muted-foreground/80 h-3 w-3 shrink-0" />
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
        {stateLabel && (
          <MetaChip compact={compact}>
            <Clock
              className={cn(
                "h-3 w-3 shrink-0",
                isOpen ? "text-muted-foreground" : "text-white/70",
              )}
            />
            <span className="font-semibold">{stateLabel}</span>
          </MetaChip>
        )}
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
