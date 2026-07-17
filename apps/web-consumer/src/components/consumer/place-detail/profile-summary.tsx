"use client";

import type React from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarCheck,
  Clock,
  Gift,
  Globe,
  Heart,
  Instagram,
  MapPin,
  Navigation,
  Phone,
  Share2,
  Star,
} from "lucide-react";

import { ComingSoonModal } from "@/components/consumer/ComingSoonModal";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import { PromoChip } from "@/components/consumer/PromoChip";
import { Spinner } from "@/components/shared";
import type { Place } from "@/lib/api/places";
import { useConsumerClass } from "@/lib/class-context";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import type { PlaceDetail } from "@/lib/mock/place";
import { formatPlacePriceChip } from "@/lib/place-price";
import { resolvePromoRateFromPlaceRow } from "@/lib/promo-rates";
import { useSavedPlaces } from "@/lib/saved-places";
import { toast } from "@/lib/toast";
import {
  cn,
  firstInitial,
  formatCompactCount,
  formatDistanceKm,
  formatRating,
} from "@/lib/utils";

// ── 1. Profile summary (IG photo+stats + swipe-style tags) ───────────────

export function ProfileSummary({ place }: { place: PlaceDetail }) {
  // decision: Pato — name in header; photo · Google · IG · reward; then
  // swipe-style tags: verification · category · price · zone · distance ·
  // hours · reward (MESITA-561).
  const googleRating = formatRating(place.google.rating)!;
  const googleCount = formatCompactCount(place.google.count, false);
  const igFollowers = formatCompactCount(place.instagram.followers, false);
  const priceLabel =
    formatPlacePriceChip({
      priceRange: place.price_range,
      priceLevel: place.price_level,
      currency: place.currency,
    }) ?? null;
  const statusValue = place.open_now
    ? `Open · until ${place.closes_at}`
    : `Closed · opens ${place.opens_at}`;
  const promoPlace = placeDetailAsPromoPlace(place);
  const isPartner = place.listing_type === "partner";

  return (
    // Full-bleed white band under the top chrome so the summary reads as
    // the page header; pink body starts at the tab strip below.
    <section className="border-border bg-card flex flex-col gap-3 border-b px-4 pt-3 pb-4">
      <div className="flex items-center gap-4">
        <div className="border-border h-[88px] w-[88px] shrink-0 overflow-hidden rounded-2xl border">
          {place.photos.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={place.photos[0]}
              alt={place.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="bg-pink-gradient flex h-full w-full items-center justify-center">
              <span className="font-display text-3xl font-bold text-white/80">
                {firstInitial(place.name)}
              </span>
            </div>
          )}
        </div>
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          <ProfileStat
            value={googleRating}
            label={`${googleCount} Google`}
            icon={
              <Star
                className="h-3 w-3 fill-amber-500 text-amber-500"
                strokeWidth={0}
              />
            }
          />
          <ProfileStat
            value={igFollowers}
            label="Instagram"
            icon={<Instagram className="h-3 w-3 text-pink-500" />}
          />
          <ProfileRewardStat place={promoPlace} />
        </div>
      </div>

      {/* decision: Pato — when the Enricher is still building the profile an
          "Enriching" chip leads the row; then verification · category ·
          price · zone · distance · hours · reward (swipe-style tags on
          light surface). MESITA-451: moved here off the header title.
          MESITA-561: reward chip mirrors swipe PromoChip (showWhenEmpty). */}
      <div className="flex flex-wrap items-center gap-1.5">
        {place.is_enriching && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap text-emerald-900"
            aria-live="polite"
          >
            <Spinner
              size="sm"
              label="Enriching"
              className="h-3 w-3 border-emerald-300 border-t-emerald-600"
            />
            Enriching
          </span>
        )}
        <ProfileMetaChip>
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
              <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold">Not Verified</span>
            </>
          )}
        </ProfileMetaChip>
        {place.category && (
          <ProfileMetaChip>
            <span className="font-semibold">{place.category}</span>
          </ProfileMetaChip>
        )}
        {priceLabel && (
          <ProfileMetaChip>
            <span className="font-semibold">{priceLabel}</span>
          </ProfileMetaChip>
        )}
        <ProfileMetaChip>
          <MapPin className="text-muted-foreground h-3 w-3 shrink-0" />
          <span className="max-w-[160px] truncate font-semibold">
            {place.zone}
          </span>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Navigation className="text-muted-foreground h-3 w-3 shrink-0" />
          <span className="font-semibold">
            {formatDistanceKm(place.distance_km)}
          </span>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Clock
            className={cn(
              "h-3 w-3 shrink-0",
              place.open_now ? "text-emerald-600" : "text-muted-foreground",
            )}
          />
          <span
            className={cn(
              "font-semibold",
              place.open_now ? "text-emerald-700" : undefined,
            )}
          >
            {statusValue}
          </span>
        </ProfileMetaChip>
        <PromoChip place={promoPlace} size="md" showWhenEmpty tone="light" />
      </div>

      <ProfileActions className="mt-5" place={place} />
    </section>
  );
}

/** Instagram-style stat cell: big number, small label underneath. */
function ProfileStat({
  value,
  label,
  icon,
}: {
  value: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center justify-center px-0.5 text-center">
      <span className="text-foreground flex items-center gap-0.5 text-[17px] leading-tight font-bold tabular-nums">
        {icon}
        {value}
      </span>
      <span className="text-muted-foreground mt-0.5 max-w-full truncate text-[10px] leading-tight font-medium">
        {label}
      </span>
    </div>
  );
}

/** Third IG-style column — reward % or “No reward”. */
function ProfileRewardStat({ place }: { place: Place }) {
  const { key: classKey } = useConsumerClass();
  const isFirstVisit = place.is_first_visit !== false;
  const promoPercent = resolvePromoRateFromPlaceRow(
    place as unknown as Record<string, unknown>,
    isFirstVisit,
    classKey === "premium",
  );
  if (promoPercent == null) {
    return (
      <ProfileStat
        value="—"
        label="No reward"
        icon={<Gift className="h-3 w-3 text-sky-500" />}
      />
    );
  }
  return (
    <ProfileStat
      value={`${promoPercent}%`}
      label={isFirstVisit ? "Welcome" : "Returning"}
      icon={<Gift className="h-3 w-3 text-sky-500" />}
    />
  );
}

/** Light-surface tag chip — same shape language as swipe MetaChip.
 *  Soft pink fill (`bg-background`) so chips read against the white summary. */
function ProfileMetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-background text-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11.5px] whitespace-nowrap tabular-nums">
      {children}
    </span>
  );
}

/** Shim PlaceDetail → Place shape PromoChip / resolvePromoRateFromPlaceRow expect. */
function placeDetailAsPromoPlace(place: PlaceDetail): Place {
  return {
    id: place.id,
    name: place.name,
    listing_type: place.listing_type,
    is_first_visit: place.promo_matrix.is_first_visit,
    welcome_free_rate: place.promo_matrix.welcome.free,
    welcome_premium_rate: place.promo_matrix.welcome.premium,
    free_rate: place.promo_matrix.default.free,
    premium_rate: place.promo_matrix.default.premium,
    reward_cap_mxn: place.reward_cap_mxn,
    currency: place.currency,
  } as unknown as Place;
}

// Save · Contact · Reserve · Share — four equal outline buttons. Save toggles
// the localStorage favorite (saved state = primary tint + filled heart).
// Reserve + Share are parked: tap opens ComingSoonModal (no "Soon" pills).
// Contact glyph prefers WhatsApp when the place has it.
function ProfileActions({
  place,
  className,
}: {
  place: PlaceDetail;
  className?: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedPlaces();
  const [contactOpen, setContactOpen] = useState(false);
  const [soonKind, setSoonKind] = useState<"reserve" | "share" | null>(null);
  const hasWhatsApp = Boolean(place.channels.whatsapp_url);
  const saved = isSaved(place.id);

  // gap-1 + whitespace-nowrap keeps all four labels on one line at 4-up.
  const outlineBtn =
    "border-border bg-card text-foreground hover:bg-muted inline-flex items-center justify-center gap-1 rounded-xl border py-2.5 text-[13px] font-semibold whitespace-nowrap transition active:scale-[0.99]";

  function onSave() {
    const nowSaved = !saved;
    toggle(place.id);
    if (nowSaved) {
      toast.action(
        `Saved ${place.name}`,
        {
          label: "View",
          onClick: () => router.push(CONSUMER_ROUTES.favorites),
        },
        { tone: "success" },
      );
    } else {
      toast(`Removed ${place.name} from saved`);
    }
  }

  return (
    <>
      <div className={cn("grid grid-cols-4 gap-2", className)}>
        <button
          type="button"
          onClick={onSave}
          aria-pressed={saved}
          aria-label={saved ? "Remove from saved" : "Save place"}
          className={cn(
            outlineBtn,
            // Saved reads RED, not brand pink — the universal "hearted" hue
            // (MESITA-587), unmistakable at a glance next to its siblings.
            saved &&
              "border-red-500/50 bg-red-500/12 text-red-600 hover:bg-red-500/18",
          )}
        >
          <Heart
            className={cn("h-4 w-4 shrink-0", saved && "fill-current")}
            strokeWidth={2.25}
          />
          {saved ? "Saved" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setContactOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={contactOpen}
          className={outlineBtn}
        >
          {hasWhatsApp ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/channels/whatsapp.svg"
              alt=""
              aria-hidden
              className="h-4 w-4 shrink-0"
            />
          ) : (
            <Phone className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          )}
          Contact
        </button>
        <button
          type="button"
          onClick={() => setSoonKind("reserve")}
          className={outlineBtn}
        >
          <CalendarCheck className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Reserve
        </button>
        <button
          type="button"
          onClick={() => setSoonKind("share")}
          className={outlineBtn}
        >
          <Share2 className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          Share
        </button>
      </div>
      <PlaceContactSheet
        place={place}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
      />
      <ComingSoonModal
        open={soonKind === "reserve"}
        onClose={() => setSoonKind(null)}
        title="Reservations coming soon"
        body="Book a table from Mesita shortly — for now, use Contact to reach the place."
        icon={CalendarCheck}
      />
      <ComingSoonModal
        open={soonKind === "share"}
        onClose={() => setSoonKind(null)}
        title="Sharing coming soon"
        body="You'll be able to share this place with friends from here soon."
        icon={Share2}
      />
    </>
  );
}
