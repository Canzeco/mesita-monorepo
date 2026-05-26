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
  Settings,
  Link2,
} from "lucide-react";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
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
      <ReviewsSummaryBox venue={venue} />
      <IndividualReviewsBox venue={venue} />
      <MenuBox venue={venue} />
      <LocationBox venue={venue} />
      <HoursBox venue={venue} />
      <PromoBox venue={venue} />
      <MatrixBox venue={venue} />
      <AboutBox venue={venue} />
      <DetailsBox venue={venue} />
      <LinksBox venue={venue} />
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
  const meta = [
    "$".repeat(venue.price_level),
    `${venue.distance_km} km · ${venue.walk_minutes} min walk`,
    venue.open_now ? `Open until ${venue.closes_at}` : `Closes at ${venue.closes_at}`,
  ];
  return (
    <Box className="!gap-2">
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
        {venue.vibe} · {venue.category}
      </p>
      <h1 className="font-display -mt-1 text-3xl leading-tight font-semibold tracking-tight">
        {venue.name}
      </h1>
      <p className="text-muted-foreground text-sm">{meta.join(" · ")}</p>
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{venue.address}</span>
      </p>
      <p className="text-foreground mt-1 text-base leading-relaxed">
        {venue.short_description}
      </p>
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
    <Box title="Reviews summary" icon={Star} iconColor="text-violet-400">
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
          meta={`${formatCount(venue.facebook.fans, false)} fans`}
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
      <span className="font-display text-base leading-none font-bold text-blue-600">
        G
      </span>
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
  diamond: "text-diamond",
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
      <p className="text-muted-foreground text-[11px]">
        Mesita · {v.community} · {formatCount(v.followers, false)} followers
      </p>
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
      <div className="bg-background flex items-center gap-3 rounded-xl p-3">
        <div className="bg-muted flex h-9 w-9 items-center justify-center rounded-full">
          <Utensils className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-display text-base font-semibold">Full menu</p>
          <p className="text-muted-foreground text-xs">
            {venue.menu.pages} pages · {venue.menu.updated_label}
          </p>
        </div>
        <button
          type="button"
          className="bg-foreground text-background inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          View
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
      <BoxHScroll>
        {venue.menu.dishes.map((d) => (
          <div
            key={d.name}
            className="bg-background flex w-32 shrink-0 flex-col overflow-hidden rounded-2xl"
          >
            <div className="bg-pink-gradient flex aspect-square items-center justify-center">
              <span className="font-display text-3xl font-bold text-white/70">
                {firstInitial(d.name)}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 p-3">
              <p className="line-clamp-2 text-[12px] font-semibold leading-tight">
                {d.name}
              </p>
              <p className="text-muted-foreground text-[11px]">{d.price}</p>
            </div>
          </div>
        ))}
      </BoxHScroll>
    </Box>
  );
}

// ── 6. Location ─────────────────────────────────────────────────────────

function LocationBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box
      title="Location"
      icon={MapPin}
      iconColor="text-pink-500"
      right={`${venue.walk_minutes} min walk`}
    >
      <div
        className="relative aspect-[16/9] overflow-hidden rounded-xl"
        style={{
          backgroundColor: "#1d1442",
          backgroundImage: `
            linear-gradient(rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168, 85, 247, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.18) 0%, transparent 65%)
          `,
          backgroundSize: "36px 36px, 36px 36px, 100% 100%",
        }}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <div className="bg-pink-gradient shadow-glow flex h-12 w-12 items-center justify-center rounded-full">
            <MapPin
              className="h-5 w-5 fill-white text-white"
              strokeWidth={1.5}
            />
          </div>
          <span className="rounded-full bg-black/80 px-3 py-1 text-xs font-medium text-white">
            {venue.name}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{venue.address}</p>
    </Box>
  );
}

// ── 6b. Hours & popular times ───────────────────────────────────────────

function HoursBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box
      title="Hours & popular times"
      icon={Clock}
      iconColor="text-violet-400"
      right={`${venue.timezone} · ${venue.city}`}
    >
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
        {venue.popular_times.map((d) => (
          <DayCard key={d.day} day={d} />
        ))}
      </BoxHScroll>
    </Box>
  );
}

function DayCard({ day }: { day: VenueDetail["popular_times"][number] }) {
  return (
    <div className="bg-background flex w-32 shrink-0 flex-col gap-3 rounded-2xl p-3">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
        {day.day}
      </p>
      <div className="flex h-20 items-end gap-1">
        {day.bars.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-full bg-gradient-to-t from-purple-500 to-pink-500"
            style={{ height: `${Math.max(v * 100, 6)}%` }}
          />
        ))}
      </div>
      <p className="text-muted-foreground text-[10px]">{day.range}</p>
    </div>
  );
}

// ── 7. Promotion ────────────────────────────────────────────────────────

function PromoBox({ venue }: { venue: VenueDetail }) {
  const symbol = venue.promo.reward_kind === "cashback" ? "$" : "%";
  return (
    <section className="bg-pink-gradient shadow-glow flex items-center justify-between rounded-2xl p-4 text-white">
      <div>
        <p className="text-[10px] font-bold tracking-wider text-white/80 uppercase">
          {venue.promo.badge_label}
        </p>
        <p className="font-display mt-1 text-xl leading-tight font-semibold">
          {venue.promo.reward_value}% {venue.promo.reward_kind} on every visit
        </p>
        <p className="mt-0.5 text-[11px] text-white/80">
          {symbol === "$" ? "Formal venue" : "Informal venue"} · auto-applied
        </p>
      </div>
      <Sparkles className="h-7 w-7 text-white/85" />
    </section>
  );
}

// ── 8. Promo matrix ─────────────────────────────────────────────────────

const TIER_ORDER: Tier[] = ["bronze", "silver", "gold", "diamond"];
const TIER_PROPER: Record<Tier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

function MatrixBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box title="Your reward by class">
      <div className="grid grid-cols-2 gap-2">
        {TIER_ORDER.map((tier) => {
          const value = venue.promo_matrix[tier];
          const current = tier === venue.promo_matrix.current_tier;
          return (
            <div
              key={tier}
              className={cn(
                "bg-background relative overflow-hidden rounded-xl p-3",
                current && "ring-1 ring-current/40",
                current && TIER_TEXT[tier],
              )}
            >
              <div
                className={cn(
                  "absolute inset-x-0 top-0 h-1",
                  TIER_AVATAR_BG[tier],
                )}
              />
              <p
                className={cn(
                  "text-[10px] font-bold tracking-wider uppercase",
                  TIER_TEXT[tier],
                )}
              >
                {TIER_PROPER[tier]}
              </p>
              <p className="font-display text-foreground mt-1 text-xl font-semibold">
                {value}%
              </p>
              <p className="text-muted-foreground text-[11px]">
                {venue.promo.reward_kind}
              </p>
              {current && (
                <span className="bg-foreground text-background absolute top-2 right-2 rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase">
                  Current
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-[11px]">
        Higher class earns more. Upgrade in Profile.
      </p>
    </Box>
  );
}

// ── 9. About ────────────────────────────────────────────────────────────

function AboutBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box title="About">
      <p className="text-muted-foreground text-sm leading-relaxed">
        {venue.long_description}
      </p>
    </Box>
  );
}

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
  const rows: Array<[string, string]> = [
    ["Category", venue.details.category_full],
    ["Zone", venue.details.zone],
    ["Price level", "$".repeat(venue.price_level)],
    ["Hours", `${venue.opens_at} – ${venue.closes_at}`],
    ["Distance", `${venue.walk_minutes} Min Walk`],
    ["Participation", venue.details.participation],
    ["Mechanic", venue.details.mechanic],
  ];
  return (
    <Box title="Details" icon={Settings} iconColor="text-pink-400">
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
  return (
    <Box title="Channels & links" icon={Link2} iconColor="text-cyan-400">
      <ChipGroup title="Channels" defs={CHANNEL_DEFS} urls={venue.channels} />
      <ChipGroup
        title="Reserve & order"
        defs={RESERVATION_DEFS}
        urls={venue.reservations}
      />
      <ChipGroup
        title="Reviews & maps"
        defs={REVIEW_DEFS}
        urls={venue.reviews_maps}
      />
    </Box>
  );
}

function ChipGroup<K extends string>({
  title,
  defs,
  urls,
}: {
  title: string;
  defs: readonly { key: K; label: string; Icon: typeof Globe }[];
  urls: Partial<Record<K, string | undefined>>;
}) {
  const active = defs.filter((d) => !!urls[d.key]);
  if (active.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-muted-foreground text-[10px] font-bold tracking-wider uppercase">
        {title}
      </h4>
      <div className="flex flex-wrap gap-2">
        {active.map(({ key, label, Icon }) => (
          <a
            key={key}
            href={urls[key]}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-background text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </a>
        ))}
      </div>
    </div>
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
