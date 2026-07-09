"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  Star,
  Sparkles,
  Globe,
  Gift,
  Instagram,
  Facebook,
  Twitter,
  AtSign,
  MessageCircle,
  Music2,
  CalendarCheck,
  Bike,
  ChevronRight,
  Utensils,
  Users,
  Heart,
  Clock,
  Tags,
  Link2,
  Car,
  Phone,
  BadgeCheck,
  ShieldAlert,
  Pencil,
  Info,
  Crown,
  Navigation,
  QrCode,
} from "lucide-react";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
import { PopularTimesCard } from "@/components/consumer/PopularTimesCard";
import { AboutBox } from "@/components/consumer/AboutBox";
import { ReviewCard } from "@/components/consumer/ReviewCard";
import {
  FacebookLogo,
  GoogleLogo,
  InstagramLogo,
  MesitaMark,
} from "@/components/consumer/BrandLogos";
import { SectionAnchor } from "@/components/consumer/PlaceSectionNav";
import { useSavedPlaces } from "@/lib/saved-places";
import { classProperLabel } from "@/lib/consumer-data";
import { useConsumerClass } from "@/lib/class-context";
import { toast } from "@/lib/toast";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  resolveActivePromoRate,
  placeOffersMesitaRewards,
} from "@/lib/promo-rates";

import { cn, firstInitial } from "@/lib/utils";
import type { ConsumerClass, PlaceDetail } from "@/lib/mock/place";

// Pure presentation for the place detail surface. The two callers (full
// page at /places/[id] and the intercepted modal at @modal/(.)places/[id])
// each render their own close button on top of this. The summary header
// sits loose at the top; every section below is wrapped in a Box. A
// sticky action bar pins to the bottom of the scroll container.

export function PlaceDetailBody({ place }: { place: PlaceDetail }) {
  return (
    // pb-4 gives the last section breathing room above whatever footer
    // (action bar / nav) the parent layout renders below the scroll area.
    <div className="flex flex-col gap-3 px-4 pb-4">
      <MediaBox place={place} />
      <SectionAnchor id="overview">
        <SummaryHeader place={place} />
      </SectionAnchor>
      {/* Reward always renders. Web listings and rate-less partners get a
          "doesn't offer rewards" state inside RewardsBox rather than a hidden
          section, so all three cases (web / partner-no-rate / partner-with-
          reward) are explicit to the guest. */}
      <SectionAnchor id="rewards">
        <RewardsBox place={place} />
      </SectionAnchor>
      <SectionAnchor id="about">
        <AboutBox text={place.long_description} name={place.name} />
      </SectionAnchor>
      <SectionAnchor id="reviews">
        <ReviewsSummaryBox place={place} />
      </SectionAnchor>
      <IndividualReviewsBox place={place} />
      <SectionAnchor id="menu">
        <ProductsBox place={place} />
      </SectionAnchor>
      <SectionAnchor id="hours">
        <HoursBox place={place} />
      </SectionAnchor>
      <SectionAnchor id="location">
        <LocationBox place={place} />
      </SectionAnchor>
      <SectionAnchor id="contact">
        <LinksBox place={place} />
      </SectionAnchor>
      <SectionAnchor id="details">
        <TagsBox place={place} />
      </SectionAnchor>
      <OwnershipClaimBox place={place} />
    </div>
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
            <span className="text-muted-foreground text-xs font-medium">
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

// ── 1. Summary (loose header) ───────────────────────────────────────────

function SummaryHeader({ place }: { place: PlaceDetail }) {
  // 10-item layout, top to bottom:
  //   row 1 (1 cell, full width)  : place name
  //   rows 2–5 (2 cells each, 50/50): trust + identity + commerce + place
  //     ↳ Verified Partner / Web Listed │ Updated …
  //     ↳ Category                       │ Google rating + count
  //     ↳ Price range                    │ Open/closed status
  //     ↳ Neighbourhood (zone)           │ Distance
  //
  // The reward used to render as a full-width banner here too, but it's
  // redundant now that the dedicated Reward section sits right below
  // Overview — so this header is identity/commerce/place only.
  //
  // The middle 8 cells share a uniform StatCell shape — colored icon
  // circle + display-font value + muted sub — so the grid reads as one
  // legible matrix instead of seven different chip shapes piled on top.
  const isPartner = place.listing_type === "partner";
  const googleRating = place.google.rating.toFixed(1);
  const igFollowers = formatCount(place.instagram.followers, false);
  const fullCategory = place.details.category_full.trim();
  const showFullCategory =
    fullCategory.length > 0 &&
    fullCategory.toLowerCase() !== place.category.toLowerCase();
  const statusValue = place.open_now
    ? `Open · until ${place.closes_at}`
    : `Closed · opens ${place.opens_at}`;
  return (
    // bg-card-soft is the gradient utility (white → faint pink) — gives
    // the summary card a premium "anchor" feel against the discover
    // surfaces it leads into, without competing with the photos above.
    <Box className="bg-card-soft !gap-4">
      <h1 className="font-display text-[28px] leading-[1.1] font-semibold tracking-tight break-words">
        {place.name}
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        <OverviewChip capitalize>{place.category}</OverviewChip>
        {showFullCategory && (
          <OverviewChip capitalize>{fullCategory}</OverviewChip>
        )}
        <OverviewChip>{formatPerPersonPrice(place.price_range)}</OverviewChip>
        <OverviewChip
          icon={Star}
          iconClass="text-amber-500 fill-amber-500"
          iconStrokeWidth={0}
        >
          {googleRating}
          <span className="text-muted-foreground">
            ({formatCount(place.google.count, false)})
          </span>
        </OverviewChip>
        <OverviewChip icon={Instagram} iconClass="text-pink-500">
          {igFollowers}
          <span className="text-muted-foreground">followers</span>
        </OverviewChip>
        <OverviewChip
          icon={Clock}
          iconClass={place.open_now ? "text-emerald-600" : "text-muted-foreground"}
        >
          {statusValue}
        </OverviewChip>
        <OverviewChip icon={Navigation} iconClass="text-muted-foreground">
          {place.distance_km} km
        </OverviewChip>
        <OverviewChip icon={MapPin} iconClass="text-muted-foreground">
          {place.zone}
        </OverviewChip>
        <OverviewChip
          icon={isPartner ? BadgeCheck : ShieldAlert}
          iconClass={isPartner ? "fill-sky-500 text-white" : "text-amber-500"}
        >
          {isPartner ? "Verified Partner" : "Not Verified"}
        </OverviewChip>
        <OverviewChip icon={Pencil} iconClass="text-white/70">
          Updated {place.last_updated_label}
        </OverviewChip>
      </div>
    </Box>
  );
}

function OverviewChip({
  icon: Icon,
  children,
  capitalize = false,
  iconClass,
  iconStrokeWidth = 2.25,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
  capitalize?: boolean;
  iconClass?: string;
  iconStrokeWidth?: number;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[15px] leading-tight font-semibold whitespace-nowrap text-foreground tabular-nums [font-variant-numeric:tabular-nums_lining-nums]",
        capitalize && "capitalize",
      )}
    >
      {Icon && (
        <Icon
          className={cn("h-4 w-4 shrink-0", iconClass ?? "text-muted-foreground")}
          strokeWidth={iconStrokeWidth}
        />
      )}
      {children}
    </span>
  );
}

// ── 2. Media ────────────────────────────────────────────────────────────

function MediaBox({ place }: { place: PlaceDetail }) {
  // Hero treatment: bleeds past the body's px-4 so the photo spans the
  // full page width under the sticky top bar.
  return (
    <div className="-mx-4 overflow-hidden">
      {place.photos.length > 0 ? (
        <ImageCarousel
          photos={place.photos}
          alt={place.name}
          aspect="aspect-square"
        />
      ) : (
        <div className="bg-pink-gradient flex aspect-square items-center justify-center">
          <span className="font-display text-8xl font-bold text-white/70">
            {firstInitial(place.name)}
          </span>
        </div>
      )}
    </div>
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

// ── 4. Relevant reviews (merged carousel) ───────────────────────────────

function IndividualReviewsBox({ place }: { place: PlaceDetail }) {
  // Interleave Mesita visitors and Google reviews so featured cards from
  // both sources sit in one carousel. Mesita leads (richer, owned data).
  const items: Array<
    | { kind: "mesita"; data: PlaceDetail["mesita_visitors"][number] }
    | { kind: "google"; data: PlaceDetail["google_reviews"][number] }
  > = [];
  const maxLen = Math.max(
    place.mesita_visitors.length,
    place.google_reviews.length,
  );
  for (let i = 0; i < maxLen; i++) {
    if (place.mesita_visitors[i]) {
      items.push({ kind: "mesita", data: place.mesita_visitors[i] });
    }
    if (place.google_reviews[i]) {
      items.push({ kind: "google", data: place.google_reviews[i] });
    }
  }
  if (items.length === 0) return null;

  return (
    <Box
      title="Relevant reviews"
      icon={MessageCircle}
      iconColor="text-pink-400"
    >
      <BoxHScroll>
        {items.map((item, i) => (
          <ReviewCard key={`${item.kind}-${i}`} {...item} />
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
  const menus = place.products.menu;
  if (menus.length === 0) return null;
  return (
    <Box title="Products" icon={Utensils} iconColor="text-amber-400">
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
      right={`${place.distance_km} km`}
    >
      <div
        className="relative aspect-[5/2] overflow-hidden rounded-xl"
        style={{
          backgroundColor: "#1d1442",
          backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.18) 0%, transparent 65%)
          `,
          backgroundSize: "32px 32px, 32px 32px, 100% 100%",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
          <div className="bg-pink-gradient shadow-glow flex h-10 w-10 items-center justify-center rounded-full">
            <MapPin
              className="h-4 w-4 fill-white text-white"
              strokeWidth={1.5}
            />
          </div>
          <span className="rounded-full bg-black/80 px-2.5 py-0.5 text-[11px] font-medium text-white">
            {place.name}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{place.address}</p>
      <div className="grid grid-cols-2 gap-2">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-background text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition"
        >
          <MapPin className="h-4 w-4 text-pink-500" />
          Google Maps
        </a>
        <a
          href={uberUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-background text-foreground hover:bg-muted inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition"
        >
          <Car className="h-4 w-4" />
          Ask Uber
        </a>
      </div>
    </Box>
  );
}

// ── Time (hours & popular times) ────────────────────────────────────────

function HoursBox({ place }: { place: PlaceDetail }) {
  return (
    <Box
      title="Time"
      icon={Clock}
      iconColor="text-violet-400"
      right={place.timezone}
    >
      <div className="bg-background rounded-lg px-4 py-2.5 text-sm">
        <span className="font-semibold text-emerald-700">
          {place.open_now ? "Open now" : "Closed"}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-foreground font-medium">
          {place.opens_at} – {place.closes_at}
        </span>
      </div>
      <BoxHScroll>
        <HoursTableCard place={place} />
        {place.popular_times.length > 0 && (
          <PopularTimesCard
            popularTimes={place.popular_times}
            initialDay={place.popular_times_featured}
          />
        )}
      </BoxHScroll>
    </Box>
  );
}

function HoursTableCard({ place }: { place: PlaceDetail }) {
  return (
    <article className="bg-background flex w-72 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4">
      <div>
        <h4 className="font-display text-base font-semibold">Hours</h4>
        <p className="text-muted-foreground text-[11px]">{place.city}</p>
      </div>
      <dl className="flex flex-col gap-1.5">
        {place.hours_table.map((row) => (
          <div
            key={row.day}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <dt className="text-muted-foreground">{row.day}</dt>
            <dd className="text-foreground font-medium">{row.range}</dd>
          </div>
        ))}
      </dl>
    </article>
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

const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe },
  { key: "whatsapp_url", label: "WhatsApp", Icon: MessageCircle },
  { key: "instagram_url", label: "Instagram", Icon: Instagram },
  { key: "tiktok_url", label: "TikTok", Icon: Music2 },
  { key: "facebook_url", label: "Facebook", Icon: Facebook },
  { key: "x_url", label: "X", Icon: Twitter },
  { key: "threads_url", label: "Threads", Icon: AtSign },
  { key: "reddit_url", label: "Reddit", Icon: MessageCircle },
] as const;

const RESERVATION_DEFS = [
  { key: "opentable_url", label: "OpenTable", Icon: CalendarCheck },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck },
  { key: "uber_eats_url", label: "Uber Eats", Icon: Bike },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike },
] as const;

const REVIEW_DEFS = [
  { key: "tripadvisor_url", label: "TripAdvisor", Icon: Star },
  { key: "google_maps_url", label: "Google Maps", Icon: MapPin },
] as const;

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

function OwnershipClaimBox({ place }: { place: PlaceDetail }) {
  // Only unverified web listings can be claimed. Verified partners already
  // have an owner on record, so the claim CTA would be redundant.
  if (place.listing_type === "partner") return null;
  return (
    <Box title="Ownership" icon={ShieldAlert} iconColor="text-amber-400">
      <p className="text-muted-foreground text-xs leading-relaxed">
        This place is currently listed as not verified.
      </p>
      <a
        href="https://business.mesita.ai/add"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-500/30 transition hover:bg-amber-500/15"
      >
        Are you the owner of this place? Claim ownership
        <ChevronRight className="h-3.5 w-3.5" />
      </a>
    </Box>
  );
}

function LinksBox({ place }: { place: PlaceDetail }) {
  // Flatten every link source into a single chip set — no subgroups.
  // Phone leads since calling is the most direct contact action; the
  // rest follow channel / reservation / review order.
  const chips: {
    key: string;
    label: string;
    Icon: typeof Globe;
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
      chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  for (const def of RESERVATION_DEFS) {
    const url = place.reservations[def.key];
    if (url)
      chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  for (const def of REVIEW_DEFS) {
    const url = place.reviews_maps[def.key];
    if (url)
      chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  if (chips.length === 0) return null;
  return (
    <Box title="Channels" icon={Link2} iconColor="text-cyan-400">
      <div className="flex flex-wrap gap-2">
        {chips.map(({ key, label, Icon, url }) => (
          <a
            key={key}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-background text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </a>
        ))}
      </div>
    </Box>
  );
}

// ── Action bar ──────────────────────────────────────────────────────────
//
// Rendered by the place modal shell + the hard-nav page as a sibling AFTER
// the scrollable body so its opaque buttons can't occlude content. shrink-0
// keeps it from compressing inside the parent's flex-col.
//
// Two equal buttons, full width each:
//   • Save place — toggles the place in the localStorage saved-places
//     store. Place-only since the "byebye coupons-as-entity" checkpoint:
//     saving no longer mints a coupon as a side effect. Toast confirms;
//     tap "View" to jump to /saved.
//   • Reserve table — parked while the booking flow ships. Rendered
//     disabled + muted so the action bar still reads complete, but it
//     opens nothing (the ReservationSheet wiring was removed). Un-park by
//     restoring an onReserve handler when reservations go live.
export function PlaceDetailActionBar({
  placeId,
  placeName,
}: {
  placeId: string;
  placeName: string;
}) {
  const router = useRouter();
  const { isSaved, toggle } = useSavedPlaces();
  const saved = isSaved(placeId);

  function onSavePlace() {
    const nowSaved = !saved;
    toggle(placeId);
    if (nowSaved) {
      toast.action(
        `Saved ${placeName}`,
        {
          label: "View",
          onClick: () => router.push(CONSUMER_ROUTES.favorites),
        },
        { tone: "success" },
      );
    } else {
      toast(`Removed ${placeName} from saved`);
    }
  }

  return (
    <div className="border-border bg-background/85 flex shrink-0 gap-2 border-t px-4 pt-3 pb-4 backdrop-blur">
      <button
        type="button"
        onClick={onSavePlace}
        aria-pressed={saved}
        className={cn(
          "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-3 text-sm font-semibold transition active:scale-[0.99]",
          saved
            ? "bg-pink-gradient shadow-glow border-transparent text-white hover:brightness-110"
            : "border-border bg-card text-foreground hover:bg-muted",
        )}
      >
        <Heart
          className={cn("h-4 w-4", saved && "fill-current")}
          strokeWidth={2}
        />
        {saved ? "Saved" : "Save place"}
      </button>
      {/* Parked: reservations aren't live yet, so this is a disabled,
          muted CTA (no onClick, cursor-not-allowed) sitting beside the
          live Save button. The "Soon" tag tells the user it's upcoming
          rather than broken. */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        className="border-border bg-muted text-muted-foreground inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border py-3 text-sm font-semibold"
      >
        <CalendarCheck className="h-4 w-4" strokeWidth={2} />
        Reserve table
        <span className="bg-foreground/10 text-muted-foreground rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide uppercase">
          Soon
        </span>
      </button>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCount(n: number, exact: boolean): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  // `exact` keeps counts that matter (e.g. review counts) as "1,891" rather
  // than collapsing to "1.9K".
  if (exact && n >= 1000) return n.toLocaleString("en-US");
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatPerPersonPrice(priceRange: string): string {
  if (!priceRange) return "Price unavailable";
  if (/per person/i.test(priceRange)) return priceRange;
  return `${priceRange} per person`;
}
