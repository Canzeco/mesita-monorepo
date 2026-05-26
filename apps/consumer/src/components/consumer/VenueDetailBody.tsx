import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  MapPin,
  Star,
  Sparkles,
  Globe,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  AtSign,
  MessageCircle,
  Music2,
  CalendarCheck,
  Bike,
  ChevronRight,
  Utensils,
  Users,
  Bookmark,
  Clock,
  Tags,
  Link2,
  Car,
  Phone,
  BadgeCheck,
  Pencil,
  Info,
  Crown,
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
import {
  SectionAnchor,
  VenueSectionNav,
} from "@/components/consumer/VenueSectionNav";

const NAV_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "rewards", label: "Rewards" },
  { id: "reviews", label: "Reviews" },
  { id: "menu", label: "Menu" },
  { id: "hours", label: "Hours" },
  { id: "location", label: "Location" },
  { id: "about", label: "About" },
  { id: "details", label: "Details" },
] as const;
import { cn, firstInitial } from "@/lib/utils";
import type { Tier, VenueDetail } from "@/lib/mock/venue";

// Pure presentation for the venue detail surface. The two callers (full
// page at /venues/[id] and the intercepted modal at @modal/(.)venues/[id])
// each render their own close button on top of this. The summary header
// sits loose at the top; every section below is wrapped in a Box. A
// sticky action bar pins to the bottom of the scroll container.

export function VenueDetailBody({ venue }: { venue: VenueDetail }) {
  return (
    <div className="flex flex-col gap-3 px-4 pb-0">
      <MediaBox venue={venue} />
      <VenueSectionNav sections={[...NAV_SECTIONS]} />
      <SectionAnchor id="overview">
        <SummaryHeader venue={venue} />
      </SectionAnchor>
      <SectionAnchor id="rewards">
        <RewardsBox venue={venue} />
      </SectionAnchor>
      <SectionAnchor id="reviews">
        <ReviewsSummaryBox venue={venue} />
      </SectionAnchor>
      <IndividualReviewsBox venue={venue} />
      <SectionAnchor id="menu">
        <MenuBox venue={venue} />
      </SectionAnchor>
      <SectionAnchor id="hours">
        <HoursBox venue={venue} />
      </SectionAnchor>
      <SectionAnchor id="location">
        <LocationBox venue={venue} />
      </SectionAnchor>
      <SectionAnchor id="about">
        <AboutBox text={venue.long_description} />
      </SectionAnchor>
      <LinksBox venue={venue} />
      <SectionAnchor id="details">
        <DetailsBox venue={venue} />
      </SectionAnchor>
      <ActionBar />
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

function SummaryHeader({ venue }: { venue: VenueDetail }) {
  // Venue page shows the real per-person range (price_range, e.g.
  // "$200–300"). Quick-view surfaces — swipe, catalog, map — keep
  // rendering price_level as the $-symbol shorthand. Closing time
  // moves out of the summary meta — the Hours box owns it.
  const meta = [venue.category, venue.price_range, `${venue.distance_km} km`];
  const isPartner = venue.listing_type === "partner";
  // Star rating in the Summary uses the Google source for now — easiest
  // single-number stand-in until we surface a combined Mesita+Google
  // headline rating. Renders inline at the start of the meta row.
  const googleRating = venue.google.rating.toFixed(1);
  const googleCount = venue.google.count.toLocaleString("en-US");
  // Active reward chip — first-visit users see the welcome rate,
  // returning users see the default-tier rate. Null = venue offers
  // nothing at the user's tier, so the chip is suppressed.
  const { welcome, default: returning, current_tier, is_first_visit } =
    venue.promo_matrix;
  const activeReward = is_first_visit
    ? welcome[current_tier]
    : returning[current_tier];
  const mechanicWord = venue.details.mechanic.toLowerCase();
  return (
    <Box className="!gap-2">
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight break-words">
        {venue.name}
      </h1>
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-sm">
        <span className="inline-flex items-center gap-1">
          <Star
            className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
            strokeWidth={0}
          />
          <span className="text-foreground font-semibold">{googleRating}</span>
          <span>({googleCount})</span>
        </span>
        <span>·</span>
        <span>{meta.join(" · ")}</span>
      </p>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {activeReward != null && (
          <>
            <span className="bg-pink-gradient shadow-glow inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white">
              <Sparkles className="h-3 w-3" />
              {activeReward}% {mechanicWord}
            </span>
            <span>·</span>
          </>
        )}
        <span className="inline-flex items-center gap-1.5">
          {isPartner ? (
            <BadgeCheck className="h-4 w-4 text-emerald-400" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          <span className="text-foreground font-medium">
            {isPartner ? "Verified partner" : "Web listing"}
          </span>
        </span>
        <span>·</span>
        <span className="inline-flex items-center gap-1.5">
          <Pencil className="h-3.5 w-3.5" />
          Updated {venue.last_updated_label}
        </span>
      </div>
    </Box>
  );
}

// ── 2. Media ────────────────────────────────────────────────────────────

function MediaBox({ venue }: { venue: VenueDetail }) {
  // Hero treatment: bleeds past the body's px-4 so the photo spans the
  // full page width under the sticky top bar.
  return (
    <div className="-mx-4 overflow-hidden">
      {venue.photos.length > 0 ? (
        <ImageCarousel
          photos={venue.photos}
          alt={venue.name}
          aspect="aspect-square"
        />
      ) : (
        <div className="bg-pink-gradient flex aspect-square items-center justify-center">
          <span className="font-display text-8xl font-bold text-white/70">
            {firstInitial(venue.name)}
          </span>
        </div>
      )}
    </div>
  );
}

// ── 3. Reviews summary ──────────────────────────────────────────────────

function ReviewsSummaryBox({ venue }: { venue: VenueDetail }) {
  // Brand-new venues default to 5.0 across the board with 0 reviews until
  // the first real one lands; once mesita_reviews.total > 0 we trust the
  // averaged values that come in on the row.
  const hasReviews = venue.mesita_reviews.total > 0;
  const overall = hasReviews ? venue.mesita_reviews.overall : 5.0;
  const subRatings: Array<[string, number]> = [
    ["Food", hasReviews ? venue.mesita_reviews.food : 5.0],
    ["Service", hasReviews ? venue.mesita_reviews.service : 5.0],
    ["Ambience", hasReviews ? venue.mesita_reviews.ambiance : 5.0],
    ["Value", hasReviews ? venue.mesita_reviews.value : 5.0],
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
            {venue.mesita_reviews.total} reviews
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-pink-500/10 ring-pink-500/30 flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl ring-1">
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
          value={venue.google.rating.toFixed(1)}
          meta={`${formatCount(venue.google.count, true)} reviews`}
        />
        <ExternalCard
          logo={<InstagramLogo />}
          icon="users"
          value={formatCount(venue.instagram.followers, false)}
          meta="followers"
        />
        <ExternalCard
          logo={<FacebookLogo />}
          icon="star"
          value={venue.facebook.rating.toFixed(1)}
          meta={`${formatCount(venue.facebook.followers, false)} followers`}
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

// Tier label / avatar bg / text tokens shared between IndividualReviewsBox
// (mesita visitor cards) and the Rewards box (tier cards). Diamond text
// reads as blue here; the global --tier-diamond gradient stays violet.

const TIER_AVATAR_BG: Record<Tier, string> = {
  bronze: "bg-tier-bronze",
  silver: "bg-tier-silver",
  gold: "bg-tier-gold",
  diamond: "bg-tier-diamond",
};
const TIER_TEXT: Record<Tier, string> = {
  bronze: "text-bronze",
  silver: "text-silver",
  gold: "text-gold",
  // Diamond text reads as blue across the venue page even though the
  // tier-diamond gradient stripe still uses the violet token. Local
  // override on purpose — the global tier-diamond token stays untouched
  // so other apps (admin/business) keep their existing diamond hue.
  diamond: "text-sky-400",
};

function IndividualReviewsBox({ venue }: { venue: VenueDetail }) {
  // Interleave Mesita visitors and Google reviews so featured cards from
  // both sources sit in one carousel. Mesita leads (richer, owned data).
  const items: Array<
    | { kind: "mesita"; data: VenueDetail["mesita_visitors"][number] }
    | { kind: "google"; data: VenueDetail["google_reviews"][number] }
  > = [];
  const maxLen = Math.max(
    venue.mesita_visitors.length,
    venue.google_reviews.length,
  );
  for (let i = 0; i < maxLen; i++) {
    if (venue.mesita_visitors[i]) {
      items.push({ kind: "mesita", data: venue.mesita_visitors[i] });
    }
    if (venue.google_reviews[i]) {
      items.push({ kind: "google", data: venue.google_reviews[i] });
    }
  }

  return (
    <Box title="Relevant reviews" icon={MessageCircle} iconColor="text-pink-400">
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

// ── 5. Menu ─────────────────────────────────────────────────────────────

function MenuBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box title="Menu" icon={Utensils} iconColor="text-amber-400">
      <div className="flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2">
        <Info className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <p className="text-[11px] leading-snug text-amber-100/90">
          Reference only — current menu prices may differ at the venue.
        </p>
      </div>
      {venue.menus.map((m) => (
        <MenuRow key={m.name} menu={m} />
      ))}
    </Box>
  );
}

function MenuRow({ menu }: { menu: VenueDetail["menus"][number] }) {
  return (
    <div className="bg-background flex items-center gap-3 rounded-xl p-3">
      <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
        <Utensils className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display truncate text-base font-semibold">
          {menu.name}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {menu.pages} pages · {menu.updated_label}
        </p>
      </div>
      <button
        type="button"
        className="bg-foreground text-background inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        View
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── 6. Location ─────────────────────────────────────────────────────────

function LocationBox({ venue }: { venue: VenueDetail }) {
  const mapsUrl =
    venue.reviews_maps.google_maps_url ??
    `https://maps.google.com/?q=${encodeURIComponent(venue.address)}`;
  const uberUrl = `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${encodeURIComponent(venue.address)}`;
  return (
    <Box
      title="Location"
      icon={MapPin}
      iconColor="text-pink-500"
      right={`${venue.distance_km} km`}
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
            {venue.name}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{venue.address}</p>
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

// ── 6b. Hours & popular times ───────────────────────────────────────────

function HoursBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box title="Hours & popular times" icon={Clock} iconColor="text-violet-400">
      <div className="bg-background rounded-full px-4 py-2.5 text-sm">
        <span className="font-semibold text-emerald-400">
          {venue.open_now ? "Open now" : "Closed"}
        </span>
        <span className="text-muted-foreground"> · </span>
        <span className="text-foreground font-medium">
          {venue.opens_at} – {venue.closes_at}
        </span>
      </div>
      <BoxHScroll>
        <HoursTableCard venue={venue} />
        <PopularTimesCard
          popularTimes={venue.popular_times}
          initialDay={venue.popular_times_featured}
        />
      </BoxHScroll>
    </Box>
  );
}

function HoursTableCard({ venue }: { venue: VenueDetail }) {
  return (
    <article className="bg-background flex w-72 shrink-0 snap-start flex-col gap-3 rounded-2xl p-4">
      <div>
        <h4 className="font-display text-base font-semibold">Hours</h4>
        <p className="text-muted-foreground text-[11px]">
          {venue.timezone} · {venue.city}
        </p>
      </div>
      <dl className="flex flex-col gap-1.5">
        {venue.hours_table.map((row) => (
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

// ── 7. Rewards (welcome on top + 4-up tier grid) ────────────────────────

// Tiers render as a non-scrollable 4-column grid: Bronze · Silver · Gold ·
// Diamond ascend left-to-right like a ladder. Welcome lives outside this
// constant and renders as the full-width hero card above the grid.
const TIER_ORDER: Tier[] = ["bronze", "silver", "gold", "diamond"];
const TIER_RANK: Record<Tier, number> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  diamond: 3,
};
const TIER_PROPER: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

function RewardsBox({ venue }: { venue: VenueDetail }) {
  const { welcome, default: returning, current_tier, is_first_visit } =
    venue.promo_matrix;
  // Active reward = welcome variant on a first visit, default variant
  // otherwise. Null means the venue offers nothing at this tier — the
  // hero still renders so the user knows where they stand.
  const activeValue = is_first_visit
    ? welcome[current_tier]
    : returning[current_tier];
  const currentRank = TIER_RANK[current_tier];
  // Mechanic comes in capitalized ("Cashback" / "Discount") so it can sit
  // in a subtitle pill; lowercase it when reading inline with the
  // percentage ("20% cashback").
  const mechanicWord = venue.details.mechanic.toLowerCase();
  const capLabel = `MX$${venue.reward_cap_mxn.toLocaleString("en-US")}`;
  const subtitleParts: string[] = [`as Mesita ${TIER_PROPER[current_tier]}`];
  if (activeValue != null) {
    subtitleParts.push(is_first_visit ? "first visit" : "on returning visits");
    subtitleParts.push(`capped at ${capLabel} / visit`);
  }
  return (
    <Box title="Your reward by class" icon={Sparkles} iconColor="text-pink-400">
      {/* Hero — names the active reward, mechanic, and cap up front. */}
      <div className="bg-pink-gradient shadow-glow rounded-xl p-3 text-white">
        <p className="text-[10px] font-bold tracking-wider text-white/90 uppercase">
          Your reward
        </p>
        <p className="font-display mt-1 text-3xl font-semibold leading-none">
          {activeValue == null ? "—" : `${activeValue}% ${mechanicWord}`}
        </p>
        <p className="mt-1 text-xs leading-snug text-white/90">
          {subtitleParts.join(" · ")}
        </p>
      </div>

      {/* First-visit ladder — Welcome × tier. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          First visit
        </p>
        <div className="grid grid-cols-4 gap-2">
          {TIER_ORDER.map((tier) => {
            const rank = TIER_RANK[tier];
            const relation: "lower" | "current" | "higher" =
              rank < currentRank
                ? "lower"
                : rank === currentRank
                  ? "current"
                  : "higher";
            return (
              <TierCard
                key={`welcome-${tier}`}
                tier={tier}
                value={welcome[tier]}
                relation={relation}
                active={is_first_visit && tier === current_tier}
              />
            );
          })}
        </div>
      </div>

      {/* Returning-visit ladder — default × tier. "Every visit" was the
          first label but it overlaps with the first-visit ladder above; the
          recurring rate only applies once the guest has come back. */}
      <div className="flex flex-col gap-1.5">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Returning visits
        </p>
        <div className="grid grid-cols-4 gap-2">
          {TIER_ORDER.map((tier) => {
            const rank = TIER_RANK[tier];
            const relation: "lower" | "current" | "higher" =
              rank < currentRank
                ? "lower"
                : rank === currentRank
                  ? "current"
                  : "higher";
            return (
              <TierCard
                key={`default-${tier}`}
                tier={tier}
                value={returning[tier]}
                relation={relation}
                active={!is_first_visit && tier === current_tier}
              />
            );
          })}
        </div>
      </div>

      {/* CTA — the rewards box is the closest spot to the user's tier,
          so this is where "upgrade my class" lands. Wired to /profile
          once we ship a real upgrade flow; today it just routes to the
          Class tab. */}
      <Link
        href="/profile"
        className="bg-pink-gradient shadow-glow flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-white"
      >
        <Crown className="h-4 w-4" />
        Upgrade class
      </Link>
    </Box>
  );
}

function TierCard({
  tier,
  value,
  relation,
  active,
}: {
  tier: Tier;
  value: number | null;
  relation: "lower" | "current" | "higher";
  // True when this exact card represents the guest's currently active
  // reward (matches both current_tier AND the first-visit/returning-
  // visit axis). The pink-gradient styling renders only on this card.
  active: boolean;
}) {
  // `relation` is intentionally unused here — the previous design used
  // it to gate a "Join <Tier>" hover overlay on higher tiers, but the
  // overlays were removed for visual calm. We keep the prop to leave
  // the door open if we re-add tier-targeted CTAs later.
  void relation;
  if (active) {
    return (
      <div className="bg-pink-gradient shadow-glow overflow-hidden rounded-xl p-2 text-center text-white">
        <p className="text-[9px] font-bold tracking-wider text-white/90 uppercase">
          {TIER_PROPER[tier]}
        </p>
        <p className="mt-0.5 flex items-baseline justify-center gap-1">
          <span className="font-display text-lg font-semibold leading-tight">
            {value == null ? "—" : `${value}%`}
          </span>
          {value != null && (
            <span className="text-[10px] text-white/85">off</span>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="bg-background relative overflow-hidden rounded-xl p-2 text-center">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          TIER_AVATAR_BG[tier],
        )}
      />
      <p
        className={cn(
          "text-[9px] font-bold tracking-wider uppercase",
          TIER_TEXT[tier],
        )}
      >
        {TIER_PROPER[tier]}
      </p>
      <p className="mt-0.5 flex items-baseline justify-center gap-1">
        <span className="font-display text-foreground text-lg font-semibold leading-tight">
          {value == null ? "—" : `${value}%`}
        </span>
        {value != null && (
          <span className="text-muted-foreground text-[10px]">off</span>
        )}
      </p>
    </div>
  );
}

// ── 9. About lives in @/components/consumer/AboutBox (client). ──────────

// ── 10. Details ─────────────────────────────────────────────────────────

const CHANNEL_DEFS = [
  { key: "website_url", label: "Website", Icon: Globe },
  { key: "whatsapp_url", label: "WhatsApp", Icon: MessageCircle },
  { key: "instagram_url", label: "Instagram", Icon: Instagram },
  { key: "tiktok_url", label: "TikTok", Icon: Music2 },
  { key: "facebook_url", label: "Facebook", Icon: Facebook },
  { key: "x_url", label: "X", Icon: Twitter },
  { key: "youtube_url", label: "YouTube", Icon: Youtube },
  { key: "threads_url", label: "Threads", Icon: AtSign },
  { key: "reddit_url", label: "Reddit", Icon: MessageCircle },
] as const;

const RESERVATION_DEFS = [
  { key: "opentable_url", label: "OpenTable", Icon: CalendarCheck },
  { key: "resy_url", label: "Resy", Icon: CalendarCheck },
  { key: "uber_eats_url", label: "Uber Eats", Icon: Bike },
  { key: "rappi_url", label: "Rappi", Icon: Bike },
  { key: "didi_food_url", label: "DiDi Food", Icon: Bike },
] as const;

const REVIEW_DEFS = [
  { key: "tripadvisor_url", label: "TripAdvisor", Icon: Star },
  { key: "google_maps_url", label: "Google Maps", Icon: MapPin },
] as const;

function DetailsBox({ venue }: { venue: VenueDetail }) {
  // Order from "what is this place" → "how do I behave there" → "who
  // runs it" → "how does Mesita relate to it":
  //   identity         category · zone · dining style · dress code
  //   logistics        service · reservations · payment · parking
  //   amenities        amenities · accessibility · kid/pet friendly
  //   people           executive chef
  //   platform meta    participation · mechanic
  const d = venue.details;
  const rows: Array<[string, string]> = [
    ["Category", d.category_full],
    ["Zone", d.zone],
    ["Dining style", d.dining_style],
    ["Dress code", d.dress_code],
    ["Service", d.service_options.join(" · ")],
    ["Reservations", d.reservations],
    ["Payment", d.payment_methods.join(" · ")],
    ["Parking", d.parking],
    ["Amenities", d.amenities.join(" · ")],
    ["Accessibility", d.accessibility.join(" · ")],
    ["Dietary", d.dietary_options.join(" · ")],
    ["Good for", d.good_for.join(" · ")],
    ["Languages", d.languages.join(" · ")],
  ];
  if (d.kid_friendly !== undefined) {
    rows.push(["Kid friendly", d.kid_friendly ? "Yes" : "No"]);
  }
  if (d.pet_friendly !== undefined) {
    rows.push(["Pet friendly", d.pet_friendly ? "Yes" : "No"]);
  }
  if (d.established_year) {
    rows.push(["Established", String(d.established_year)]);
  }
  if (d.executive_chef) {
    rows.push(["Executive chef", d.executive_chef]);
  }
  rows.push(["Participation", d.participation]);
  rows.push(["Mechanic", d.mechanic]);
  return (
    <Box title="Details" icon={Tags} iconColor="text-pink-400">
      <dl className="flex flex-col gap-3">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-4"
          >
            <dt className="text-muted-foreground text-sm">{label}</dt>
            <dd className="text-foreground text-right text-sm font-medium">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </Box>
  );
}

function LinksBox({ venue }: { venue: VenueDetail }) {
  // Flatten every link source into a single chip set — no subgroups.
  // Phone leads since calling is the most direct contact action; the
  // rest follow channel / reservation / review order.
  const chips: { key: string; label: string; Icon: typeof Globe; url: string }[] =
    [];
  if (venue.phone) {
    chips.push({
      key: "phone",
      label: "Phone",
      Icon: Phone,
      url: `tel:${venue.phone.replace(/\s+/g, "")}`,
    });
  }
  for (const def of CHANNEL_DEFS) {
    const url = venue.channels[def.key];
    if (url) chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  for (const def of RESERVATION_DEFS) {
    const url = venue.reservations[def.key];
    if (url) chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
  }
  for (const def of REVIEW_DEFS) {
    const url = venue.reviews_maps[def.key];
    if (url) chips.push({ key: def.key, label: def.label, Icon: def.Icon, url });
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

// ── Floating action bar ─────────────────────────────────────────────────

function ActionBar() {
  return (
    <div className="border-border bg-background/95 sticky bottom-0 -mx-4 mt-3 flex flex-col gap-2 border-t px-4 pt-3 pb-4 backdrop-blur">
      <button
        type="button"
        className="bg-pink-gradient shadow-glow rounded-full py-3 text-sm font-semibold text-white"
      >
        Save + reserve
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          className="border-border bg-card text-foreground inline-flex items-center justify-center gap-1.5 rounded-full border py-2.5 text-xs font-semibold"
        >
          <Bookmark className="h-3.5 w-3.5" />
          Save coupon
        </button>
        <button
          type="button"
          className="border-border bg-card text-foreground inline-flex items-center justify-center gap-1.5 rounded-full border py-2.5 text-xs font-semibold"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          Reserve table
        </button>
      </div>
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
