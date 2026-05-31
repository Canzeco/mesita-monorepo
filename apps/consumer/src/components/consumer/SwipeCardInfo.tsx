import {
  BadgeCheck,
  Clock,
  Instagram,
  MapPin,
  Navigation,
  ShieldAlert,
  Star,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { neighborhoodFromAddress } from "@/lib/adapters/venue-to-detail";
import { getOpeningStatusLabel } from "@/lib/venue-status";
import { PromoChip } from "./PromoChip";

/** Venue fields — padding comes from SWIPE_CARD_FIELDS_INNER on the card face. */
export function SwipeCardInfo({
  venue,
  compact = false,
}: {
  venue: Venue;
  compact?: boolean;
}) {
  const priceLevelLabel =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const ratingLabel =
    venue.google_rating != null ? venue.google_rating.toFixed(1) : null;
  const ratingCountLabel =
    venue.google_count != null ? formatCount(venue.google_count) : null;
  const distanceLabel =
    venue.distance_km != null ? `${venue.distance_km} km` : null;
  const zoneLabel = resolveZoneLabel(venue);
  const zoneDisplay = zoneLabel ?? "Neighborhood";
  const igFollowersLabel = formatFollowers(venue.instagram_followers_count);
  const statusLabel = getOpeningStatusLabel(venue);
  const isOpen = venue.open_now === true;
  const isPartner = venue.listing_type === "partner";

  return (
    <div
      className={cn(
        "flex flex-col",
        compact ? "gap-2" : "gap-2.5 p-4 pt-3",
      )}
    >
      <h2
        className={cn(
          "leading-[1.15] font-semibold tracking-[-0.01em] text-white [text-shadow:0_2px_12px_rgba(0,0,0,0.62)]",
          compact ? "text-[1.3rem]" : "text-[1.95rem]",
        )}
      >
        {venue.name}
      </h2>

      <div className="flex flex-wrap items-center gap-1.5">
        {venue.category && (
          <MetaChip>
            <span className="font-semibold capitalize">
              {venue.category.toLowerCase()}
            </span>
          </MetaChip>
        )}
        {priceLevelLabel && (
          <MetaChip>
            <span className="font-semibold">{priceLevelLabel}</span>
          </MetaChip>
        )}
        {ratingLabel && (
          <MetaChip>
            <span className="font-semibold">{ratingLabel}</span>
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            {ratingCountLabel && (
              <span className="text-white/70">({ratingCountLabel})</span>
            )}
          </MetaChip>
        )}
        {igFollowersLabel && (
          <MetaChip>
            <Instagram className="h-3 w-3 shrink-0 text-pink-200/80" />
            <span className="font-semibold">{igFollowersLabel}</span>
            <Users className="h-3 w-3 shrink-0 text-white/70" />
          </MetaChip>
        )}
        {distanceLabel && (
          <MetaChip>
            <Navigation className="h-3 w-3 shrink-0 text-white/70" />
            <span className="font-semibold">{distanceLabel}</span>
          </MetaChip>
        )}
        <MetaChip>
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
          <MetaChip>
            <Clock
              className={cn(
                "h-3 w-3 shrink-0",
                isOpen ? "text-emerald-400" : "text-white/70",
              )}
            />
            <span className="font-semibold">{statusLabel}</span>
          </MetaChip>
        )}
        <MetaChip>
          {isPartner ? (
            <>
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 fill-sky-500 text-white"
                strokeWidth={2}
              />
              <span className="font-semibold">Verified Partner</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="font-semibold">Not Verified</span>
            </>
          )}
        </MetaChip>
        <PromoChip venue={venue} size="md" showWhenEmpty />
      </div>
    </div>
  );
}

function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-black/45 px-2.5 py-1 text-[11.5px] whitespace-nowrap text-white tabular-nums backdrop-blur-md [font-variant-numeric:tabular-nums_lining-nums]">
      {children}
    </span>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}

function formatFollowers(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function resolveZoneLabel(venue: Venue): string | null {
  if (venue.zone && venue.zone.trim().length > 0) return venue.zone;
  const fromNeighborhood = neighborhoodFromAddress(venue.address ?? undefined);
  if (fromNeighborhood) return fromNeighborhood;
  return cityFromAddress(venue.address ?? undefined);
}

function cityFromAddress(address: string | undefined): string | null {
  if (!address) return null;
  const postCodeCityMatch = address.match(/\d{5}\s+([^,]+)/);
  const direct = postCodeCityMatch?.[1]?.trim();
  if (direct && !/\d/.test(direct)) return direct;

  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const fallback = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (!fallback || /\d/.test(fallback)) return null;
  return fallback;
}
