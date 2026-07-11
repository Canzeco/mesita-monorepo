"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  Heart,
  Star,
  Sparkles,
  Globe,
  Gift,
  Instagram,
  Facebook,
  Twitter,
  AtSign,
  MessageCircle,
  CalendarCheck,
  Bike,
  ChevronRight,
  Utensils,
  Users,
  Clock,
  Tags,
  Link2,
  Phone,
  BadgeCheck,
  CircleHelp,
  Info,
  Crown,
  Navigation,
  QrCode,
  Share2,
  SquareArrowOutUpRight,
} from "lucide-react";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
import { AboutBox } from "@/components/consumer/AboutBox";
import { ReviewCard } from "@/components/consumer/ReviewCard";
import { PlaceContactSheet } from "@/components/consumer/PlaceContactSheet";
import { ComingSoonModal } from "@/components/consumer/ComingSoonModal";
import {
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
  MesitaMark,
} from "@/components/consumer/BrandLogos";
import { Spinner } from "@/components/shared";
import { classProperLabel } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useSavedPlaces } from "@/lib/saved-places";
import {
  resolveActivePromoRate,
  placeOffersMesitaRewards,
  resolvePromoRateFromPlaceRow,
} from "@/lib/promo-rates";
import { formatPlacePriceChip } from "@/lib/place-price";
import type { Place } from "@/lib/api/places";

import { cn, firstInitial } from "@/lib/utils";
import type { ConsumerClass, PlaceDetail } from "@/lib/mock/place";

// Pure presentation for the place detail surface, laid out like an
// Instagram profile. The two callers (full page at /place/[id] and the
// intercepted modal at @modal/(.)place/[id]) each render their own top
// bar (back + place name + ⋯) on top of this. Structure:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      reward; swipe-style tags; then Save · Contact · Reserve · Share.
//   2. Sticky tab strip — Place · Reviews · Products · Rewards.
//   3. The active tab's boxes.

type PlaceTab = "place" | "reviews" | "products" | "rewards";

const PLACE_TABS: Array<{ key: PlaceTab; label: string }> = [
  { key: "place", label: "Place" },
  { key: "reviews", label: "Reviews" },
  { key: "products", label: "Products" },
  { key: "rewards", label: "Rewards" },
];

export function PlaceDetailBody({ place }: { place: PlaceDetail }) {
  const [tab, setTab] = useState<PlaceTab>("place");
  return (
    // decision: Pato — white profile-summary header vs pink tab body for
    // contrast. Summary sits on bg-card; tabs + content keep bg-background.
    // pb-4 gives the last section breathing room above whatever footer
    // (nav) the parent layout renders below the scroll area.
    <div className="flex flex-col pb-4">
      <ProfileSummary place={place} />
      <div className="flex flex-col gap-3 px-4">
        <PlaceTabBar tab={tab} onChange={setTab} />
        {tab === "place" && (
          <>
            <MediaBox place={place} />
            {/* decision: Pato — Location first, then Time stacked (not side by side) */}
            <LocationBox place={place} />
            <HoursBox place={place} />
            <LinksBox place={place} />
            <AboutBox text={place.long_description} name={place.name} />
            <TagsBox place={place} />
            <VerificationBox place={place} />
            <LastUpdatedBox place={place} />
          </>
        )}
        {tab === "reviews" && (
          <>
            <ReviewsSummaryBox place={place} />
            <GoogleReviewsBox place={place} />
            <MesitaReviewsBox place={place} />
          </>
        )}
        {tab === "products" && <ProductsBox place={place} />}
        {/* Reward always renders on its tab. Web listings and rate-less
            partners get a "doesn't offer rewards" state inside RewardsBox
            rather than an empty tab, so all three cases (web / partner-no-
            rate / partner-with-reward) are explicit to the guest. */}
        {tab === "rewards" && <RewardsBox place={place} />}
      </div>
    </div>
  );
}

// ── Tab strip (Place · Reviews · Products · Rewards) ────────────────────

function PlaceTabBar({
  tab,
  onChange,
}: {
  tab: PlaceTab;
  onChange: (t: PlaceTab) => void;
}) {
  return (
    // Sticky to the top of the scroll container so the tabs stay reachable
    // while the user is deep in a tab's content. Solid bg-background (no
    // translucency) so scrolled-out content can't bleed through the strip.
    <nav
      className="bg-background border-border sticky top-0 z-20 -mx-4 grid grid-cols-4 border-b px-2"
      aria-label="Place sections"
    >
      {PLACE_TABS.map((t) => {
        const active = t.key === tab;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 py-3 text-center text-[13px] font-semibold tracking-wide transition",
              active
                ? "border-pink-500 text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

// ── Box primitive ───────────────────────────────────────────────────────

function Box({
  title,
  icon: Icon,
  iconColor,
  right,
  children,
  className,
  bare = false,
}: {
  title?: string;
  icon?: LucideIcon;
  iconColor?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bare?: boolean;
}) {
  return (
    <section
      className={cn(
        "border-border bg-card flex flex-col rounded-2xl border",
        bare ? "overflow-hidden" : "gap-3 p-4",
        className,
      )}
    >
      {(title || Icon) && (
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {Icon && (
              <Icon
                className={cn("h-4 w-4", iconColor ?? "text-muted-foreground")}
                strokeWidth={1.75}
              />
            )}
            {title && <BoxLabel>{title}</BoxLabel>}
          </div>
          {right && (
            <span className="text-muted-foreground min-w-0 shrink text-right text-xs font-medium">
              {right}
            </span>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

function BoxLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
      {children}
    </h3>
  );
}

function BoxHScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {children}
    </div>
  );
}

// ── 1. Profile summary (IG photo+stats + swipe-style tags) ───────────────

function ProfileSummary({ place }: { place: PlaceDetail }) {
  // decision: Pato — name in header; photo · Google · IG · reward; then
  // swipe-style tags: verification · category · price · zone · distance · hours.
  const googleRating = place.google.rating.toFixed(1);
  const googleCount = formatCount(place.google.count, false);
  const igFollowers = formatCount(place.instagram.followers, false);
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

      {/* decision: Pato — verification first, then category · price · zone ·
          distance · hours (swipe-style tags on light surface) */}
      <div className="flex flex-wrap items-center gap-1.5">
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

/** distance_km === 0 is the "couldn't calculate" placeholder — show "- km". */
function formatDistanceKm(km: number | null | undefined): string {
  if (km == null || km <= 0) return "- km";
  return `${km} km`;
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
// Contact glyph prefers WhatsApp when the venue has it.
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
            saved &&
              "border-primary/35 bg-primary/8 text-primary hover:bg-primary/12",
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
        body="Book a table from Mesita shortly — for now, use Contact to reach the venue."
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

// ── 2. Media (Place tab) ────────────────────────────────────────────────

function MediaBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — gallery in the same bordered card as Location/Time
  // (not full-bleed). bare Box = border + rounded-2xl, no title chrome;
  // carousel fills the card edge-to-edge inside the clip.
  if (place.photos.length === 0) return null;
  return (
    <Box bare>
      <ImageCarousel
        photos={place.photos}
        alt={place.name}
        aspect="aspect-square"
        rounded="rounded-none"
      />
    </Box>
  );
}

// ── 3. Reviews summary ──────────────────────────────────────────────────

function ReviewsSummaryBox({ place }: { place: PlaceDetail }) {
  // Brand-new places default to 5.0 across the board with 0 reviews until
  // the first real one lands; once mesita_reviews.total > 0 we trust the
  // averaged values that come in on the row.
  const hasReviews = place.mesita_reviews.total > 0;
  const overall = hasReviews ? place.mesita_reviews.overall : 5.0;
  const subRatings: Array<[string, number]> = [
    ["Food", hasReviews ? place.mesita_reviews.food : 5.0],
    ["Service", hasReviews ? place.mesita_reviews.service : 5.0],
    ["Ambience", hasReviews ? place.mesita_reviews.ambiance : 5.0],
    ["Value", hasReviews ? place.mesita_reviews.value : 5.0],
  ];
  return (
    <Box title="Reviews summary" icon={Star} iconColor="text-violet-400">
      {/* Mesita box. Layout:
            • Header row — pink "m" glyph + label + total review count.
            • Hero overall — pink-tinted square card on the left with the
              big serif rating + a gold star + "OVERALL" eyebrow.
            • Three sub-rating bars on the right (Food / Service /
              Ambiance) — pink-gradient fill proportional to value, value
              pinned to the right edge. Visual comparison beats a list of
              pills. */}
      <div className="bg-background flex flex-col gap-4 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <MesitaMark variant="sm" />
          <p className="text-foreground text-sm font-semibold">Mesita</p>
          <span className="text-muted-foreground ml-auto text-[11px]">
            {place.mesita_reviews.total} reviews
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl bg-pink-500/10 ring-1 ring-pink-500/30">
            <div className="flex items-baseline gap-1">
              <span className="font-display text-foreground text-2xl leading-none font-semibold">
                {overall.toFixed(1)}
              </span>
              <Star
                className="h-3 w-3 fill-amber-400 text-amber-400"
                strokeWidth={0}
              />
            </div>
            <span className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
              Overall
            </span>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            {subRatings.map(([label, value]) => (
              <RatingBar key={label} label={label} value={value} />
            ))}
          </div>
        </div>
      </div>

      {/* External platforms in a 3-up grid — same shape, different
          source. Three boxes paired with the Mesita box above form the
          "four boxes" reviews-summary grid. */}
      <div className="grid grid-cols-3 gap-2">
        <ExternalCard
          logo={<GoogleLogo />}
          icon="star"
          value={place.google.rating.toFixed(1)}
          meta={`${formatCount(place.google.count, true)} reviews`}
        />
        <ExternalCard
          logo={<InstagramLogo />}
          icon="users"
          value={formatCount(place.instagram.followers, false)}
          meta="followers"
        />
        <ExternalCard
          logo={<FacebookLogo />}
          icon="users"
          value={formatCount(place.facebook.followers, false)}
          meta="followers"
        />
      </div>
    </Box>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  // Pink-gradient fill proportional to value/5, value pinned to the right
  // edge in tabular nums so columns stay aligned across rows.
  const pct = Math.min(100, (value / 5) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-14 shrink-0 truncate text-[11px]">
        {label}
      </span>
      <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-pink-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-foreground w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ExternalCard({
  logo,
  icon,
  value,
  meta,
}: {
  logo: React.ReactNode;
  icon: "star" | "users";
  value: string;
  meta: string;
}) {
  return (
    <div className="bg-background flex flex-col items-center gap-1.5 rounded-xl px-2 py-3">
      <div className="mb-1">{logo}</div>
      <div className="flex items-center gap-1 text-sm font-semibold">
        {icon === "star" ? (
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
        ) : (
          <Users className="text-muted-foreground h-3.5 w-3.5" />
        )}
        {value}
      </div>
      <p className="text-muted-foreground text-[10px] leading-tight">{meta}</p>
    </div>
  );
}

// ── 4. Individual reviews (Reviews tab: Google + Mesita, one box each) ──

// decision: Pato — frontend-only review sort (no EF) for both Google and
// Mesita. Newest default; Highest / Lowest by rating. Google uses published
// date; Mesita uses avg(food/service/ambiance/value) and keeps source order
// for Newest until visitors carry a date field.
type ReviewSort = "newest" | "highest" | "lowest";

const REVIEW_SORTS: { key: ReviewSort; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "highest", label: "Highest" },
  { key: "lowest", label: "Lowest" },
];

function reviewTimeMs(date: string): number {
  const t = Date.parse(date);
  return Number.isFinite(t) ? t : 0;
}

function mesitaOverall(
  v: PlaceDetail["mesita_visitors"][number],
): number {
  return (v.food + v.service + v.ambiance + v.value) / 4;
}

function ReviewSortChips({
  sort,
  onSort,
  label,
}: {
  sort: ReviewSort;
  onSort: (next: ReviewSort) => void;
  label: string;
}) {
  return (
    <div
      className="bg-muted/60 flex gap-1 rounded-xl p-1"
      role="group"
      aria-label={label}
    >
      {REVIEW_SORTS.map((mode) => (
        <button
          key={mode.key}
          type="button"
          onClick={() => onSort(mode.key)}
          aria-pressed={sort === mode.key}
          className={cn(
            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition",
            sort === mode.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

function GoogleReviewsBox({ place }: { place: PlaceDetail }) {
  const [sort, setSort] = useState<ReviewSort>("newest");
  const reviews = place.google_reviews;
  const sorted = useMemo(() => {
    const copy = [...reviews];
    copy.sort((a, b) => {
      if (sort === "highest") {
        return b.rating - a.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date);
      }
      if (sort === "lowest") {
        return a.rating - b.rating || reviewTimeMs(b.date) - reviewTimeMs(a.date);
      }
      return reviewTimeMs(b.date) - reviewTimeMs(a.date);
    });
    return copy;
  }, [reviews, sort]);

  if (reviews.length === 0) return null;
  return (
    <Box
      title="Google reviews"
      icon={Star}
      iconColor="text-amber-400"
      right={`${formatCount(place.google.count, true)} total`}
    >
      <ReviewSortChips
        sort={sort}
        onSort={setSort}
        label="Sort Google reviews"
      />
      <BoxHScroll>
        {sorted.map((data, i) => (
          <ReviewCard
            key={`google-${data.author}-${data.date}-${i}`}
            kind="google"
            data={data}
          />
        ))}
      </BoxHScroll>
    </Box>
  );
}

function MesitaReviewsBox({ place }: { place: PlaceDetail }) {
  // Always render below Google reviews — when there are no Mesita
  // visitors yet, show an explicit empty state instead of hiding the box
  // (Safi and other new places were dropping the section entirely).
  const [sort, setSort] = useState<ReviewSort>("newest");
  const visitors = place.mesita_visitors;
  const sorted = useMemo(() => {
    if (sort === "newest") return visitors;
    const copy = [...visitors];
    copy.sort((a, b) => {
      const diff = mesitaOverall(b) - mesitaOverall(a);
      return sort === "highest" ? diff : -diff;
    });
    return copy;
  }, [visitors, sort]);

  if (visitors.length === 0) {
    return (
      <Box
        title="Mesita reviews"
        icon={MessageCircle}
        iconColor="text-pink-400"
        right={`${place.mesita_reviews.total} total`}
      >
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <MessageCircle className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-semibold">
              No Mesita reviews yet
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              Be the first guest to leave a review after visiting.
            </p>
          </div>
        </div>
      </Box>
    );
  }
  return (
    <Box
      title="Mesita reviews"
      icon={MessageCircle}
      iconColor="text-pink-400"
      right={`${place.mesita_reviews.total} total`}
    >
      <ReviewSortChips
        sort={sort}
        onSort={setSort}
        label="Sort Mesita reviews"
      />
      <BoxHScroll>
        {sorted.map((data, i) => (
          <ReviewCard
            key={`mesita-${data.handle}-${i}`}
            kind="mesita"
            data={data}
          />
        ))}
      </BoxHScroll>
    </Box>
  );
}

// ── Individual review cards live in @/components/consumer/ReviewCard
//    (client) — taller layout, optional photo thumbnail, "Read more"
//    toggle when the quote runs long.

// ── Products ────────────────────────────────────────────────────────────

function ProductsBox({ place }: { place: PlaceDetail }) {
  // Sole occupant of the Products tab, so it never returns null — an
  // empty catalog renders an explicit "no menu" state instead of a
  // blank tab.
  const menus = place.products.menu;
  if (menus.length === 0) {
    return (
      <Box title="Menu" icon={Utensils} iconColor="text-amber-400">
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <Utensils className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-semibold">
              No menu available yet
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              This place hasn&apos;t uploaded a menu or product catalog.
            </p>
          </div>
        </div>
      </Box>
    );
  }
  return (
    <Box title="Menu" icon={Utensils} iconColor="text-amber-400">
      <div className="flex items-center gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2">
        <Info
          className="h-3.5 w-3.5 shrink-0 text-amber-600"
          strokeWidth={2.25}
        />
        <p className="text-[11px] leading-snug font-medium text-amber-900">
          Reference only — current product prices may differ at the place.
        </p>
      </div>
      {menus.map((m) => (
        <ProductRow key={m.name} product={m} />
      ))}
    </Box>
  );
}

function ProductRow({
  product,
}: {
  product: PlaceDetail["products"]["menu"][number];
}) {
  function onView() {
    // Once product_catalog_url is wired through PlaceDetail this becomes a
    // direct <a target="_blank" /> link. For now there's nothing to open
    // so we surface that explicitly instead of silently doing nothing.
    toast(`${product.name} viewer ships once the place uploads a catalog`);
  }
  return (
    <div className="bg-background flex items-center gap-3 rounded-xl p-3">
      <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
        <Utensils className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-base font-semibold">
          {product.name}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {product.pages} pages · {product.updated_label}
        </p>
      </div>
      <button
        type="button"
        onClick={onView}
        className="bg-foreground text-background inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 active:scale-[0.97]"
      >
        View
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── 6. Location ─────────────────────────────────────────────────────────

function LocationBox({ place }: { place: PlaceDetail }) {
  const mapsUrl =
    place.reviews_maps.google_maps_url ??
    `https://maps.google.com/?q=${encodeURIComponent(place.address)}`;
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(place.address)}`;
  return (
    <Box
      title="Location"
      icon={MapPin}
      iconColor="text-pink-500"
      right={formatDistanceKm(place.distance_km)}
    >
      <div
        className="relative aspect-[2/1] overflow-hidden rounded-xl"
        style={{
          backgroundColor: "#1d1442",
          backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.18) 0%, transparent 65%)
          `,
          backgroundSize: "24px 24px, 24px 24px, 100% 100%",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2">
          <div className="bg-pink-gradient shadow-glow flex h-9 w-9 items-center justify-center rounded-full">
            <MapPin
              className="h-4 w-4 fill-white text-white"
              strokeWidth={1.5}
            />
          </div>
          <span className="max-w-full truncate rounded-full bg-black/80 px-2.5 py-0.5 text-[11px] font-medium text-white">
            {place.name}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs leading-snug">
        {place.address}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-950 transition hover:bg-amber-100/70"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/channels/googlemaps.svg"
            alt=""
            aria-hidden
            className="h-3.5 w-3.5 shrink-0"
          />
          Google Maps
        </a>
        <a
          href={uberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300/70 bg-zinc-100 px-3 py-2.5 text-xs font-semibold text-zinc-900 transition hover:bg-zinc-200/70"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* decision: Pato — Uber badge = black bg + white letters */}
          <img
            src="/channels/uber-badge.svg"
            alt=""
            aria-hidden
            className="h-3.5 w-auto"
          />
          Ask Uber
        </a>
      </div>
    </Box>
  );
}

// ── Time (hours) ────────────────────────────────────────────────────────

/** Full weekday name in the place timezone — matches hours_table.day. */
function todayWeekdayLabel(tz: string | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: tz || "UTC",
      weekday: "long",
    }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
      new Date(),
    );
  }
}

function HoursDayRow({
  row,
  today,
}: {
  row: { day: string; range: string };
  today: string;
}) {
  // decision: Pato — full weekday on the stacked Time card (short Mon/Tue
  // was only for the old cramped 2-col side-by-side layout).
  const isToday = row.day === today;
  const closed = row.range.toLowerCase() === "closed";
  return (
    <li
      className={cn(
        "border-border/50 flex min-w-0 items-center justify-between gap-3 border-b px-3 py-2.5 text-xs leading-tight last:border-b-0",
        isToday && "bg-violet-50/80",
      )}
    >
      <span
        className={cn(
          "shrink-0 font-semibold",
          isToday ? "text-violet-800" : "text-foreground",
        )}
      >
        {row.day}
      </span>
      <span
        className={cn(
          "min-w-0 truncate text-right tabular-nums",
          closed
            ? "text-muted-foreground"
            : isToday
              ? "text-violet-950 font-semibold"
              : "text-foreground/85",
        )}
      >
        {row.range}
      </span>
    </li>
  );
}

function HoursBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — Time below Location (full-width stack); keep timezone
  const today = todayWeekdayLabel(place.timezone);
  const statusDetail = place.open_now
    ? place.closes_at
      ? `until ${place.closes_at}`
      : null
    : place.opens_at
      ? `opens ${place.opens_at}`
      : null;
  const tz = place.timezone || undefined;

  return (
    <Box
      title="Time"
      icon={Clock}
      iconColor="text-violet-400"
      right={
        tz ? (
          <span className="max-w-[12rem] truncate" title={tz}>
            {tz}
          </span>
        ) : undefined
      }
    >
      <p className="text-xs leading-snug">
        <span
          className={cn(
            "font-semibold",
            place.open_now ? "text-emerald-700" : "text-muted-foreground",
          )}
        >
          {place.open_now ? "Open" : "Closed"}
        </span>
        {statusDetail && (
          <>
            <span className="text-muted-foreground"> · </span>
            <span className="text-foreground/80">{statusDetail}</span>
          </>
        )}
      </p>
      {place.hours_table.length > 0 && (
        <ul className="border-border overflow-hidden rounded-xl border">
          {place.hours_table.map((row) => (
            <HoursDayRow key={row.day} row={row} today={today} />
          ))}
        </ul>
      )}
    </Box>
  );
}

// ── Reward (hero + Free/Premium × first/returning matrix) ───────────────

function RewardsBox({ place }: { place: PlaceDetail }) {
  const consumerClass = useConsumerClass();
  const { welcome, default: returning, is_first_visit } = place.promo_matrix;
  const classKey = consumerClass.key;

  const offersRewards = placeOffersMesitaRewards({
    listing_type: place.listing_type,
    promo_matrix: place.promo_matrix,
    promo_configured: place.promo_configured === true,
  });
  const isPartner = place.listing_type === "partner";

  if (!offersRewards) {
    return (
      <Box title="Reward" icon={Sparkles} iconColor="text-pink-400">
        <div className="flex flex-col items-center gap-3 py-3 text-center">
          <span className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <Gift className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-col gap-1">
            <p className="text-foreground text-sm font-semibold">
              This place doesn&apos;t offer rewards
            </p>
            <p className="text-muted-foreground text-xs leading-snug">
              {isPartner
                ? "This Verified Partner isn't running a Mesita reward right now."
                : place.promo_configured
                  ? "Rewards are being set up for this place."
                  : "Only Verified Partners run the Mesita reward program — this place is a web listing."}
            </p>
          </div>
        </div>
      </Box>
    );
  }

  // Active reward = welcome variant on a first visit, default variant
  // otherwise. Null means the place offers nothing at this class — the
  // hero still renders so the user knows where they stand.
  const activeValue = resolveActivePromoRate(
    place.promo_matrix,
    classKey,
    is_first_visit,
  );
  // Every Verified Partner runs an instant discount. Lowercase it when
  // reading inline with the percentage ("20% discount").
  const mechanicWord = place.details.mechanic.toLowerCase();
  // Short suffix for the class tiles, consistent with the hero — "70% off".
  const mechanicShort = "off";
  // Ticket cap (pesos): the reward applies to the first N of the bill, then
  // full price — it is not a ceiling on the reward. 0/null means no cap, so
  // the clause is dropped entirely.
  const capLabel =
    place.reward_cap_mxn != null && place.reward_cap_mxn > 0
      ? `MX$${place.reward_cap_mxn.toLocaleString("en-US")}`
      : null;
  // Concise one-line context (the class is already shown — highlighted — in
  // the matrix below, so we don't repeat "as Mesita Premium" here).
  const visitLabel = is_first_visit ? "First visit" : "Returning visit";
  const subtitle =
    activeValue == null
      ? `No reward at Mesita ${classProperLabel(classKey)} yet`
      : capLabel
        ? `${visitLabel} · on your first ${capLabel}`
        : visitLabel;
  // The claim action depends on the guest's own account, not the place:
  //   free            → Pay with QR + Upgrade (claim now, or unlock a bigger
  //                     Premium reward)
  //   Premium (paid)  → one Pay-with-QR button, reward applies automatically
  //   Premium via IG  → one button: Pay with QR *and* post an Instagram story,
  //                     since the story is what re-verifies the IG Premium class
  const isFree = consumerClass.key === "free";
  const isPremiumViaInstagram = !isFree && consumerClass.origin === "instagram";
  return (
    <Box title="Reward" icon={Sparkles} iconColor="text-pink-400">
      {/* Hero — the active reward, mechanic, and cap. The box header already
          says "Reward", so no redundant "Your reward" eyebrow here. */}
      <div className="bg-pink-gradient shadow-glow rounded-xl p-4 text-white">
        <p className="font-display text-3xl leading-none font-semibold">
          {activeValue == null ? "—" : `${activeValue}% ${mechanicWord}`}
        </p>
        <p className="mt-1.5 text-xs leading-snug text-white/90">{subtitle}</p>
      </div>

      {/* How it works — the claim sequence, spelled out so every case is
          unambiguous at the table. The Instagram-story step only applies to
          guests whose Premium comes from Instagram; Free and paid-Premium
          guests skip straight to the reward, so it's labelled rather than
          hidden. */}
      <div className="flex flex-col gap-3">
        <BoxLabel>How it works</BoxLabel>
        <ol className="flex flex-col gap-3">
          <RewardStep
            n={1}
            icon={QrCode}
            title="Pay with your QR"
            body="Pay your bill and show your Mesita QR — the waiter scans it to start your reward."
          />
          <RewardStep
            n={2}
            icon={Instagram}
            title="Post a story — Premium via Instagram only"
            body="If your Premium comes from Instagram, post a story tagging the place right after the waiter scans your QR. Free and paid-Premium guests skip this step."
            accent
          />
          <RewardStep
            n={3}
            icon={Sparkles}
            title={`Get your ${mechanicWord}`}
            body={`Your ${mechanicWord} is applied automatically${capLabel ? ` — on the first ${capLabel} of your bill` : ""}.`}
          />
        </ol>
      </div>

      {/* One matrix instead of two ladders — First / Returning rows ×
          Free / Premium columns. The active cell is highlighted ("you are
          here") so the hero's number isn't restated as a second big tile. */}
      <RewardMatrix
        welcome={welcome}
        returning={returning}
        currentClass={classKey}
        isFirstVisit={is_first_visit}
        suffix={mechanicShort}
      />

      {/* CTAs — class- and source-aware so the exact action is unambiguous.
          Free: Pay + Upgrade. Paid Premium: one Pay button. Instagram
          Premium: one Pay-and-post-story button. */}
      <div className="flex flex-col gap-2">
        {isFree ? (
          <div className="flex gap-2">
            <Link href="/rewards" className={REWARD_PAY_BTN}>
              <QrCode className="h-4 w-4" />
              Pay with QR
            </Link>
            <Link href={CONSUMER_ROUTES.me} className={REWARD_UPGRADE_BTN}>
              <Crown className="h-4 w-4" />
              Upgrade plan
            </Link>
          </div>
        ) : (
          <Link href="/rewards" className={REWARD_PAY_BTN}>
            <QrCode className="h-4 w-4" />
            {isPremiumViaInstagram
              ? "Pay with QR & post IG story"
              : "Pay with QR to claim reward"}
          </Link>
        )}
        <p className="text-muted-foreground text-center text-[11px] leading-snug">
          {isFree
            ? "Pay with your QR to claim your reward — or upgrade to Premium for a bigger one."
            : isPremiumViaInstagram
              ? "Pay with your QR, then post an Instagram story to unlock your Premium reward."
              : "Just pay with your QR — your Premium reward applies automatically."}
        </p>
      </div>
    </Box>
  );
}

// Shared CTA button classes for the Reward box. Primary = pink-gradient pill
// (Pay with QR); secondary = outlined pill (Upgrade plan). Both grow to fill
// their row so the single-button and two-button layouts line up.
const REWARD_PAY_BTN =
  "bg-pink-gradient shadow-glow flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white";
const REWARD_UPGRADE_BTN =
  "border-border bg-card text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-semibold transition";

// One numbered step in the "How it works" sequence. The badge carries the
// step number; the tinted icon circle reads premium-violet for the
// Instagram-only step and brand-pink otherwise.
function RewardStep({
  n,
  icon: Icon,
  title,
  body,
  accent,
}: {
  n: number;
  icon: LucideIcon;
  title: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
          accent
            ? "bg-tier-premium/10 text-premium"
            : "bg-secondary/10 text-secondary",
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        <span className="bg-foreground text-background absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
          {n}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-[13px] leading-tight font-semibold">
          {title}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
          {body}
        </p>
      </div>
    </li>
  );
}

// Compact reward matrix — First / Returning rows × Free / Premium columns.
// Mirrors the Class comparison table on the Profile (FreeVsPremium) for
// visual consistency. The active cell (current class × current visit axis)
// is highlighted so "you are here" is obvious.
function RewardMatrix({
  welcome,
  returning,
  currentClass,
  isFirstVisit,
  suffix,
}: {
  welcome: { free: number | null; premium: number | null };
  returning: { free: number | null; premium: number | null };
  currentClass: ConsumerClass;
  isFirstVisit: boolean;
  /** Reward unit shown after the percent, e.g. "off". */
  suffix: string;
}) {
  const rows = [
    { key: "first", label: "First visit", vals: welcome, onAxis: isFirstVisit },
    {
      key: "returning",
      label: "Returning",
      vals: returning,
      onAxis: !isFirstVisit,
    },
  ] as const;
  return (
    <div className="border-border relative overflow-hidden rounded-xl border">
      {/* Continuous tint behind the whole Premium column (right third) so it
          reads as one column, not patched per cell. */}
      <span
        aria-hidden
        className="bg-tier-premium/[0.05] pointer-events-none absolute inset-y-0 right-0 w-1/3"
      />
      <div className="relative">
        {/* Header — Free / Premium columns. */}
        <div className="grid grid-cols-3 items-center px-3 py-2.5">
          <span />
          <span className="font-display text-center text-[13px] font-bold tracking-tight">
            Free
          </span>
          <span className="text-premium font-display flex items-center justify-center gap-1 text-[13px] font-bold tracking-tight">
            <Crown className="h-3 w-3 fill-current" />
            Premium
          </span>
        </div>
        {rows.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              "grid grid-cols-3 items-center px-3 py-3",
              i > 0 && "border-border/40 border-t",
            )}
          >
            <span className="text-muted-foreground text-[10px] font-bold tracking-[0.12em] uppercase">
              {r.label}
            </span>
            <RewardCell
              value={r.vals.free}
              suffix={suffix}
              active={r.onAxis && currentClass === "free"}
            />
            <RewardCell
              value={r.vals.premium}
              suffix={suffix}
              accent
              active={r.onAxis && currentClass === "premium"}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function RewardCell({
  value,
  suffix,
  accent,
  active,
}: {
  value: number | null;
  suffix: string;
  accent?: boolean;
  active?: boolean;
}) {
  const text = value == null ? "—" : `${value}%`;
  const num = (
    <span
      className={cn(
        "font-display text-[15px] leading-none font-bold",
        active ? "text-white" : accent ? "text-premium" : "text-foreground/80",
      )}
    >
      {text}
    </span>
  );
  const unit =
    value != null ? (
      <span
        className={cn(
          "text-[10px]",
          active
            ? "text-white/85"
            : accent
              ? "text-premium/80"
              : "text-muted-foreground",
        )}
      >
        {suffix}
      </span>
    ) : null;

  if (active) {
    return (
      <span className="flex items-center justify-center">
        <span className="bg-pink-gradient shadow-glow relative inline-flex items-baseline gap-0.5 rounded-lg py-1.5 pr-5 pl-3">
          {num}
          {unit}
          <span className="absolute top-0.5 right-1.5 text-[7px] font-bold tracking-[0.1em] text-white/85 uppercase">
            Now
          </span>
        </span>
      </span>
    );
  }
  return (
    <span className="flex items-baseline justify-center gap-0.5">
      {num}
      {unit}
    </span>
  );
}

// ── 9. About lives in @/components/consumer/AboutBox (client). ──────────

// ── 10. Tags ────────────────────────────────────────────────────────────

// `logo` points at a real brand mark in /public/channels (simple-icons SVG,
// brand colour baked in) so the Channels chips read as the actual apps.
// Channels without an available brand SVG (Website generic, OpenTable, Resy,
// DiDi Food) keep their neutral lucide `Icon` fallback.
const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe },
  {
    key: "whatsapp_url",
    label: "WhatsApp",
    Icon: MessageCircle,
    logo: "/channels/whatsapp.svg",
  },
  {
    key: "instagram_url",
    label: "Instagram",
    Icon: Instagram,
    logo: "/channels/instagram.svg",
  },
  {
    key: "facebook_url",
    label: "Facebook",
    Icon: Facebook,
    logo: "/channels/facebook.svg",
  },
  { key: "x_url", label: "X", Icon: Twitter, logo: "/channels/x.svg" },
  {
    key: "threads_url",
    label: "Threads",
    Icon: AtSign,
    logo: "/channels/threads.svg",
  },
  {
    key: "reddit_url",
    label: "Reddit",
    Icon: MessageCircle,
    logo: "/channels/reddit.svg",
  },
] as const;

const RESERVATION_DEFS = [
  {
    key: "opentable_url",
    label: "OpenTable",
    Icon: CalendarCheck,
    logo: "/channels/opentable.svg",
  },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck },
  {
    key: "uber_eats_url",
    // decision: Pato — real Uber Eats Simple Icons mark (green stacked
    // wordmark), not the fake green app-square with "eats" lettering.
    label: "Uber Eats",
    Icon: Bike,
    logo: "/channels/ubereats-mark.svg",
  },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike },
] as const;

const REVIEW_DEFS = [
  {
    key: "tripadvisor_url",
    label: "TripAdvisor",
    Icon: Star,
    logo: "/channels/tripadvisor.svg",
  },
  {
    key: "google_maps_url",
    label: "Google Maps",
    Icon: MapPin,
    logo: "/channels/googlemaps.svg",
  },
] as const;

// Soft clay brand tints for Channels chips — just a bit of each brand's
// color so the row reads as real apps, not a flat grey wall. Unknown keys
// fall back to the neutral surface.
const CHANNEL_CLAY: Record<string, string> = {
  phone: "border-emerald-200/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70",
  website_url: "border-sky-200/70 bg-sky-50 text-sky-900 hover:bg-sky-100/70",
  whatsapp_url:
    "border-emerald-200/70 bg-emerald-50 text-emerald-900 hover:bg-emerald-100/70",
  instagram_url: "border-pink-200/70 bg-pink-50 text-pink-900 hover:bg-pink-100/70",
  facebook_url: "border-blue-200/70 bg-blue-50 text-blue-900 hover:bg-blue-100/70",
  x_url: "border-zinc-300/70 bg-zinc-100 text-zinc-900 hover:bg-zinc-200/70",
  threads_url: "border-zinc-300/70 bg-zinc-100 text-zinc-900 hover:bg-zinc-200/70",
  reddit_url: "border-orange-200/70 bg-orange-50 text-orange-900 hover:bg-orange-100/70",
  opentable_url: "border-red-200/70 bg-red-50 text-red-900 hover:bg-red-100/70",
  resy_url: "border-rose-200/70 bg-rose-50 text-rose-900 hover:bg-rose-100/70",
  uber_eats_url:
    "border-green-200/70 bg-green-50 text-green-900 hover:bg-green-100/70",
  didi_food_url:
    "border-orange-200/70 bg-orange-50 text-orange-900 hover:bg-orange-100/70",
  tripadvisor_url:
    "border-lime-200/70 bg-lime-50 text-lime-900 hover:bg-lime-100/70",
  google_maps_url:
    "border-amber-200/70 bg-amber-50 text-amber-950 hover:bg-amber-100/70",
};

// Per-facet chip tint. Each of the 17 taxonomy facets gets its own light
// tone (bg / text / border) plus a leading dot so the cluster reads as a
// differentiated, premium chip set rather than one flat grey wall. Mirrors
// RatePill's "banded/tinted by value" idea, applied per facet group instead
// of per percent. Unknown facets fall back to a neutral slate tone.
const FACET_TINT: Record<string, { chip: string; dot: string }> = {
  payment: {
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
  },
  booking: { chip: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  service: {
    chip: "bg-teal-50 text-teal-700 border-teal-200",
    dot: "bg-teal-500",
  },
  vibe: {
    chip: "bg-pink-50 text-pink-700 border-pink-200",
    dot: "bg-pink-500",
  },
  occasion: {
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    dot: "bg-rose-500",
  },
  amenities: {
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    dot: "bg-indigo-500",
  },
  dietary: {
    chip: "bg-lime-50 text-lime-700 border-lime-200",
    dot: "bg-lime-500",
  },
  menu: {
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
  },
  drinks: {
    chip: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
    dot: "bg-fuchsia-500",
  },
  entertainment: {
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    dot: "bg-violet-500",
  },
  crowd: {
    chip: "bg-cyan-50 text-cyan-700 border-cyan-200",
    dot: "bg-cyan-500",
  },
  setting: {
    chip: "bg-orange-50 text-orange-700 border-orange-200",
    dot: "bg-orange-500",
  },
  hours: {
    chip: "bg-blue-50 text-blue-700 border-blue-200",
    dot: "bg-blue-500",
  },
  dress: {
    chip: "bg-purple-50 text-purple-700 border-purple-200",
    dot: "bg-purple-500",
  },
  wellness: {
    chip: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
  },
  experiences: {
    chip: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
  },
  values: {
    chip: "bg-yellow-50 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
  },
};

const FACET_TINT_FALLBACK = {
  chip: "bg-slate-50 text-slate-700 border-slate-200",
  dot: "bg-slate-400",
};

function TagChips({ tags }: { tags: PlaceDetail["tags"] }) {
  // Render nothing when the place has no tags. Otherwise a flat, wrapping
  // cluster of rounded-full pills, ordered by the incoming sort_order (the
  // adapter preserves the EF order), each tinted by its facet group with a
  // leading colored dot.
  if (tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const tint = FACET_TINT[t.facet] ?? FACET_TINT_FALLBACK;
        return (
          <span
            key={t.slug}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold",
              tint.chip,
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tint.dot)}
            />
            {t.label}
          </span>
        );
      })}
    </div>
  );
}

function TagsBox({ place }: { place: PlaceDetail }) {
  // Tags only — the curated taxonomy chip cluster (one tint per facet).
  // The old key/value rows (dining style, dress code, reservations,
  // payment, parking, good for) were noise here; those facts are being
  // absorbed into the tag vocabulary itself (Atlas taxonomy v2). The
  // whole box disappears when the place has no tags.
  if (place.tags.length === 0) return null;
  return (
    <Box title="Tags" icon={Tags} iconColor="text-pink-400">
      <TagChips tags={place.tags} />
    </Box>
  );
}

function VerificationBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — one Verification box (status + claim CTA). Never
  // ShieldAlert for unverified — reads as a security vulnerability.
  const isPartner = place.listing_type === "partner";
  return (
    <Box
      title="Verification"
      icon={isPartner ? BadgeCheck : CircleHelp}
      iconColor={isPartner ? "text-sky-500" : "text-slate-400"}
    >
      {isPartner ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          <span className="text-foreground font-semibold">
            Verified Partner.
          </span>{" "}
          This business signed up on Mesita, confirmed ownership, and can run
          rewards and take reservations through the app.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground text-xs leading-relaxed">
            <span className="text-foreground font-semibold">Not verified.</span>{" "}
            This is a web listing Mesita found online. Details may be
            incomplete, and the place can’t offer Mesita rewards until an owner
            claims it. Claiming ownership is completely free.
          </p>
          <a
            href="https://business.mesita.ai/add"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/10 px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-slate-500/25 transition hover:bg-slate-500/15"
          >
            Are you the owner? Claim ownership — it&apos;s free
            <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </>
      )}
    </Box>
  );
}

function LastUpdatedBox({ place }: { place: PlaceDetail }) {
  // decision: Pato — same card chrome as Tags / Verification (not bare footer meta).
  if (!place.is_enriching && !place.last_updated_label) return null;
  return (
    <Box title="Last update" icon={Clock} iconColor="text-slate-400">
      <div
        className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5"
        aria-live="polite"
      >
        {place.is_enriching && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <Spinner
              size="sm"
              label="Enriching"
              className="h-3 w-3 border-emerald-300 border-t-emerald-600"
            />
            Enriching
          </span>
        )}
        {place.last_updated_label && (
          <p className="text-muted-foreground text-sm font-medium tracking-wide">
            Updated {place.last_updated_label}
          </p>
        )}
      </div>
    </Box>
  );
}

type LinkChipDef = {
  key: string;
  label: string;
  Icon: typeof Globe;
  logo?: string;
  logoWide?: boolean;
  logoOnly?: boolean;
};

function linkChipLogo(def: LinkChipDef) {
  return {
    logo: def.logo,
    logoWide: def.logoWide,
    logoOnly: def.logoOnly,
  };
}

function LinksBox({ place }: { place: PlaceDetail }) {
  // Flatten every link source into a single chip set — no subgroups.
  // Phone leads since calling is the most direct contact action; the
  // rest follow channel / reservation / review order.
  const chips: {
    key: string;
    label: string;
    Icon: typeof Globe;
    logo?: string;
    logoWide?: boolean;
    logoOnly?: boolean;
    url: string;
  }[] = [];
  if (place.phone) {
    chips.push({
      key: "phone",
      label: "Phone",
      Icon: Phone,
      url: `tel:${place.phone.replace(/\s+/g, "")}`,
    });
  }
  for (const def of CHANNEL_DEFS) {
    const url = place.channels[def.key];
    if (url)
      chips.push({
        key: def.key,
        label: def.label,
        Icon: def.Icon,
        ...linkChipLogo(def),
        url,
      });
  }
  for (const def of RESERVATION_DEFS) {
    const url = place.reservations[def.key];
    if (url)
      chips.push({
        key: def.key,
        label: def.label,
        Icon: def.Icon,
        ...linkChipLogo(def),
        url,
      });
  }
  for (const def of REVIEW_DEFS) {
    const url = place.reviews_maps[def.key];
    if (url)
      chips.push({
        key: def.key,
        label: def.label,
        Icon: def.Icon,
        ...linkChipLogo(def),
        url,
      });
  }
  if (chips.length === 0) return null;
  // decision: light like Location / About — drop the inverted Channels surface.
  // Soft clay brand tints (CHANNEL_CLAY) so each chip reads as its app.
  return (
    <Box title="Channels" icon={Link2} iconColor="text-cyan-400">
      <div className="flex flex-wrap gap-2">
        {chips.map(({ key, label, Icon, logo, logoWide, logoOnly, url }) => {
          // decision: trailing SquareArrowOutUpRight on web destinations so
          // chips read as "leaves the app" — skip tel: (Phone opens dialer).
          const leavesApp = !url.startsWith("tel:");
          return (
            <a
              key={key}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={
                logoOnly
                  ? leavesApp
                    ? `${label} (opens externally)`
                    : label
                  : undefined
              }
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition",
                CHANNEL_CLAY[key] ??
                  "border-border bg-background text-foreground hover:bg-muted",
              )}
            >
              {logo ? (
                // Real brand mark (SVG in /public/channels, brand colour baked
                // in). The chip label carries the accessible name, so the glyph
                // is decorative. next/image adds nothing for a 14px static SVG.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logo}
                  alt=""
                  aria-hidden
                  className={cn(logoWide ? "h-4 w-auto" : "h-3.5 w-3.5")}
                />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              {!logoOnly && label}
              {leavesApp && (
                <SquareArrowOutUpRight
                  className="h-3 w-3 opacity-55"
                  aria-hidden
                  strokeWidth={2}
                />
              )}
            </a>
          );
        })}
      </div>
    </Box>
  );
}

// ── Action bar — removed. Save + Make reservation moved into the
//    Instagram-style ProfileSummary buttons at the top of the body. ──────

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCount(n: number, exact: boolean): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  // `exact` keeps counts that matter (e.g. review counts) as "1,891" rather
  // than collapsing to "1.9K".
  if (exact && n >= 1000) return n.toLocaleString("en-US");
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
