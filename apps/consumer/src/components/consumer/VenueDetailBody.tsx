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
} from "lucide-react";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
import { PopularTimesCard } from "@/components/consumer/PopularTimesCard";
import { AboutBox } from "@/components/consumer/AboutBox";
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
      <SummaryHeader venue={venue} />
      <RewardsBox venue={venue} />
      <ReviewsSummaryBox venue={venue} />
      <IndividualReviewsBox venue={venue} />
      <MenuBox venue={venue} />
      <LocationBox venue={venue} />
      <HoursBox venue={venue} />
      <AboutBox text={venue.long_description} />
      <LinksBox venue={venue} />
      <DetailsBox venue={venue} />
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
  const meta = [
    venue.category,
    venue.price_range,
    `${venue.distance_km} km`,
  ];
  const isPartner = venue.listing_type === "partner";
  return (
    <Box className="!gap-2">
      <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight break-words">
        {venue.name}
      </h1>
      <p className="text-muted-foreground text-sm">{meta.join(" · ")}</p>
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
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
  const ratings: Array<[string, number]> = [
    ["Mesita · Food", venue.mesita_reviews.food],
    ["Mesita · Service", venue.mesita_reviews.service],
    ["Mesita · Ambiance", venue.mesita_reviews.ambiance],
    ["Mesita · Overall", venue.mesita_reviews.overall],
  ];
  return (
    <Box
      title="Reviews summary"
      icon={Star}
      iconColor="text-violet-400"
      right={`${venue.mesita_reviews.total} Mesita reviews`}
    >
      <div className="grid grid-cols-2 gap-2">
        {ratings.map(([label, value]) => (
          <RatingPill key={label} label={label} value={value} />
        ))}
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2">
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

function RatingPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background flex items-center justify-between gap-2 rounded-full px-3 py-2">
      <span className="text-foreground truncate text-xs">{label}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold">
        <Star
          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
          strokeWidth={0}
        />
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

function GoogleLogo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white">
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
        <path
          fill="#FFC107"
          d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
        />
        <path
          fill="#FF3D00"
          d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
        />
        <path
          fill="#4CAF50"
          d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
        />
        <path
          fill="#1976D2"
          d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
        />
      </svg>
    </div>
  );
}

function InstagramLogo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
      <Instagram className="h-4 w-4 text-white" strokeWidth={2} />
    </div>
  );
}

function FacebookLogo() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1877F2]">
      <Facebook
        className="h-4 w-4 fill-white text-white"
        strokeWidth={0}
      />
    </div>
  );
}

// ── 4. Individual reviews (merged carousel) ─────────────────────────────

const TIER_LABEL: Record<Tier, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  diamond: "DIAMOND",
};
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
    <Box title="Individual reviews" icon={MessageCircle} iconColor="text-pink-400">
      <BoxHScroll>
        {items.map((item, i) =>
          item.kind === "mesita" ? (
            <MesitaCard key={`m-${i}`} v={item.data} />
          ) : (
            <GoogleCard key={`g-${i}`} r={item.data} />
          ),
        )}
      </BoxHScroll>
    </Box>
  );
}

function MesitaCard({
  v,
}: {
  v: VenueDetail["mesita_visitors"][number];
}) {
  return (
    <article className="bg-background flex w-64 shrink-0 flex-col gap-3 rounded-2xl p-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white/90",
            TIER_AVATAR_BG[v.tier],
          )}
        >
          {firstInitial(v.name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{v.name}</p>
          <p className="text-muted-foreground truncate text-[11px]">
            {v.handle}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full border border-current/30 px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase",
            TIER_TEXT[v.tier],
          )}
        >
          {TIER_LABEL[v.tier]}
        </span>
      </div>
      <p className="font-display text-sm leading-snug italic">
        “{v.quote}”
      </p>
      <div className="text-muted-foreground mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10px]">
        <span>Food {v.food}</span>
        <span>Service {v.service}</span>
        <span>Atm {v.ambiance}</span>
        <span>Value {v.value}</span>
      </div>
    </article>
  );
}

function GoogleCard({
  r,
}: {
  r: VenueDetail["google_reviews"][number];
}) {
  return (
    <article className="bg-background flex w-64 shrink-0 flex-col gap-2 rounded-2xl p-4">
      <div className="flex items-center gap-2">
        <GoogleLogo />
        <p className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
          Google
        </p>
      </div>
      <div className="flex items-center gap-0.5 text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "h-3.5 w-3.5",
              i < r.rating ? "fill-current" : "opacity-30",
            )}
            strokeWidth={0}
          />
        ))}
      </div>
      <p className="text-foreground line-clamp-5 text-sm leading-snug">
        “{r.quote}”
      </p>
      <p className="text-muted-foreground mt-auto pt-1 text-[11px]">
        {r.author} · {r.date}
      </p>
    </article>
  );
}

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
  const currentTier = venue.promo_matrix.current_tier;
  const currentValue = venue.promo_matrix[currentTier];
  const currentRank = TIER_RANK[currentTier];
  return (
    <Box title="Your reward by class" icon={Sparkles} iconColor="text-pink-400">
      <WelcomeCard discount={venue.welcome_discount} />
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
              key={tier}
              tier={tier}
              value={venue.promo_matrix[tier]}
              relation={relation}
            />
          );
        })}
      </div>
      <p className="text-muted-foreground text-[11px] leading-relaxed">
        Welcome {venue.welcome_discount.value}% (1 / month, first visit) ·
        Diamond {venue.promo_matrix.diamond}% · Gold {venue.promo_matrix.gold}%
        · Silver {venue.promo_matrix.silver}% · Bronze{" "}
        {venue.promo_matrix.bronze}%. Your current reward is{" "}
        <span className="text-foreground font-medium">
          {currentValue}% off as Mesita {TIER_PROPER[currentTier]}
        </span>
        , capped at MX${venue.reward_cap_mxn.toLocaleString("en-US")} per visit.
      </p>
      <div className="border-border flex items-center justify-between border-t pt-3 text-xs">
        <span className="text-muted-foreground">Reward mechanic</span>
        <span className="text-foreground font-medium">
          {venue.details.mechanic}
        </span>
      </div>
    </Box>
  );
}

function WelcomeCard({
  discount,
}: {
  discount: VenueDetail["welcome_discount"];
}) {
  // Compact layout matches the tier-grid card height — same padding,
  // same value type-size, gradient stripe across the top. The
  // "1 / month · first visit" detail still lives in the helper paragraph
  // below the grid, so nothing is lost.
  return (
    <div className="group bg-background relative overflow-hidden rounded-xl p-2 text-center">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-500 via-pink-500 to-amber-400" />
      <p className="text-[9px] font-bold tracking-wider text-violet-400 uppercase">
        Welcome
      </p>
      <p className="mt-0.5 flex items-baseline justify-center gap-1">
        <span className="font-display text-foreground text-lg font-semibold leading-tight">
          {discount.value}%
        </span>
        <span className="text-muted-foreground text-[10px]">off</span>
      </p>
      <CardHoverAction label="Claim" variant="primary" />
    </div>
  );
}

function TierCard({
  tier,
  value,
  relation,
}: {
  tier: Tier;
  value: number;
  relation: "lower" | "current" | "higher";
}) {
  if (relation === "current") {
    return (
      <div className="group bg-pink-gradient shadow-glow relative overflow-hidden rounded-xl p-2 text-center text-white">
        <p className="text-[9px] font-bold tracking-wider text-white/90 uppercase">
          {TIER_PROPER[tier]}
        </p>
        <p className="mt-0.5 flex items-baseline justify-center gap-1">
          <span className="font-display text-lg font-semibold leading-tight">
            {value}%
          </span>
          <span className="text-[10px] text-white/85">off</span>
        </p>
        <CardHoverAction label="Manage" variant="light" />
      </div>
    );
  }
  return (
    <div className="group bg-background relative overflow-hidden rounded-xl p-2 text-center">
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
          {value}%
        </span>
        <span className="text-muted-foreground text-[10px]">off</span>
      </p>
      {relation === "higher" && (
        <CardHoverAction label={`Join`} variant="primary" />
      )}
    </div>
  );
}

function CardHoverAction({
  label,
  variant,
}: {
  label: string;
  variant: "primary" | "light";
}) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100">
      <button
        type="button"
        className={cn(
          "rounded-full px-3 py-1.5 text-[11px] font-semibold shadow-sm",
          variant === "primary"
            ? "bg-pink-gradient shadow-glow text-white"
            : "bg-white text-zinc-900",
        )}
      >
        {label}
      </button>
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
  // Only the bits not already surfaced elsewhere on the page: Category,
  // Zone, Participation. Price level lives in the Summary meta, Hours
  // in the Hours box, Distance in the Location box, Mechanic in the
  // Rewards box right slot.
  const rows: Array<[string, string]> = [
    ["Category", venue.details.category_full],
    ["Zone", venue.details.zone],
    ["Participation", venue.details.participation],
    ["Service", venue.details.service_options.join(" · ")],
  ];
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
