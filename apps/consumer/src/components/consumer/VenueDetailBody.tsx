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
} from "lucide-react";
import { ImageCarousel } from "@/components/consumer/ImageCarousel";
import { cn, firstInitial } from "@/lib/utils";
import type { Tier, VenueDetail } from "@/lib/mock/venue";

// Pure presentation for the venue detail surface. The two callers (full
// page at /venues/[id] and the intercepted modal at @modal/(.)venues/[id])
// each render their own dismiss chrome around this. Every section is wrapped
// in a Box so the page reads as a vertical stack of modular cards. Inner
// items (review cards, visitor cards, dish cards, tier tiles) drop to
// bg-background so they recede inside their host box.

export function VenueDetailBody({ venue }: { venue: VenueDetail }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-12 pb-10">
      <SummaryBox venue={venue} />
      <MediaBox venue={venue} />
      <ReviewsBox venue={venue} />
      <GoogleReviewsBox venue={venue} />
      <MesitaVisitorsBox venue={venue} />
      <MenuBox venue={venue} />
      <PromoBox venue={venue} />
      <MatrixBox venue={venue} />
      <AboutBox venue={venue} />
      <DetailsBox venue={venue} />
    </div>
  );
}

// ── Box primitive ───────────────────────────────────────────────────────

function Box({
  title,
  children,
  className,
  bare = false,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  // bare = no padding (used by the media card so the photo fills edge-to-edge).
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
      {title && <BoxLabel>{title}</BoxLabel>}
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

// Horizontal-scroll strip designed to live inside a `Box` with p-4. The
// negative margin cancels the box's padding so cards bleed to the inner
// edge, and the right padding leaves a comfortable card-peek.
function BoxHScroll({ children }: { children: React.ReactNode }) {
  return (
    <div className="scrollbar-hide -mx-4 flex gap-3 overflow-x-auto px-4 pb-1">
      {children}
    </div>
  );
}

// ── 1. Summary ──────────────────────────────────────────────────────────

function SummaryBox({ venue }: { venue: VenueDetail }) {
  const meta = [
    "$".repeat(venue.price_level),
    `${venue.distance_km} km · ${venue.walk_minutes} min walk`,
    venue.open_now ? `Open until ${venue.closes_at}` : `Closes at ${venue.closes_at}`,
  ];
  return (
    <Box>
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.18em] uppercase">
        {venue.vibe} · {venue.category}
      </p>
      <h1 className="font-display -mt-1 text-3xl leading-tight font-semibold tracking-tight">
        {venue.name}
      </h1>
      <p className="text-muted-foreground -mt-1 text-sm">{meta.join(" · ")}</p>
      <p className="text-muted-foreground flex items-start gap-2 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{venue.address}</span>
      </p>
      <p className="text-foreground text-base leading-relaxed">
        {venue.short_description}
      </p>
    </Box>
  );
}

// ── 2. Media ────────────────────────────────────────────────────────────

function MediaBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box bare>
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
    </Box>
  );
}

// ── 3. Reviews summary ──────────────────────────────────────────────────

function ReviewsBox({ venue }: { venue: VenueDetail }) {
  const bars: Array<[string, number]> = [
    ["Food", venue.mesita_reviews.food],
    ["Service", venue.mesita_reviews.service],
    ["Ambiance", venue.mesita_reviews.ambiance],
    ["Overall", venue.mesita_reviews.overall],
  ];
  return (
    <Box title="Reviews">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-display text-4xl font-semibold tracking-tight">
            {venue.mesita_reviews.overall.toFixed(1)}
          </p>
          <div className="mt-1 flex items-center gap-1 text-amber-400">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-3.5 w-3.5 fill-current"
                strokeWidth={0}
              />
            ))}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            {venue.mesita_reviews.total} on Mesita
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          {bars.map(([label, value]) => (
            <RatingBar key={label} label={label} value={value} />
          ))}
        </div>
      </div>
      <div className="border-border -mx-4 grid grid-cols-3 gap-px overflow-hidden border-t bg-white/5">
        <ExternalStat
          label="Google"
          value={venue.google.rating.toFixed(1)}
          meta={`${formatCount(venue.google.count)} reviews`}
        />
        <ExternalStat
          label="Instagram"
          value={formatCount(venue.instagram.followers)}
          meta="followers"
        />
        <ExternalStat
          label="Facebook"
          value={formatCount(venue.facebook.followers)}
          meta="followers"
        />
      </div>
    </Box>
  );
}

function RatingBar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value / 5)) * 100;
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground w-16 text-[11px]">{label}</span>
      <div className="bg-muted relative h-1.5 flex-1 overflow-hidden rounded-full">
        <div
          className="bg-pink-gradient absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 text-right text-[11px] font-semibold">
        {value.toFixed(1)}
      </span>
    </div>
  );
}

function ExternalStat({
  label,
  value,
  meta,
}: {
  label: string;
  value: string;
  meta: string;
}) {
  return (
    <div className="bg-card flex flex-col gap-0.5 px-4 py-3">
      <p className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
        {label}
      </p>
      <p className="font-display text-lg leading-none font-semibold">{value}</p>
      <p className="text-muted-foreground text-[10px]">{meta}</p>
    </div>
  );
}

// ── 4. Google reviews ───────────────────────────────────────────────────

function GoogleReviewsBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box title="From Google">
      <BoxHScroll>
        {venue.google_reviews.map((r) => (
          <article
            key={r.author}
            className="bg-background flex w-60 shrink-0 flex-col gap-2 rounded-2xl p-4"
          >
            <p className="text-muted-foreground text-[9px] font-bold tracking-wider uppercase">
              Google
            </p>
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
            <p className="text-foreground line-clamp-4 text-sm leading-snug">
              “{r.quote}”
            </p>
            <p className="text-muted-foreground mt-auto pt-1 text-[11px]">
              {r.author} · {r.date}
            </p>
          </article>
        ))}
      </BoxHScroll>
    </Box>
  );
}

// ── 5. Mesita visitors ─────────────────────────────────────────────────

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

function MesitaVisitorsBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box title="Who's been here">
      <BoxHScroll>
        {venue.mesita_visitors.map((v) => (
          <article
            key={v.handle}
            className="bg-background flex w-64 shrink-0 flex-col gap-3 rounded-2xl p-4"
          >
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
              {v.community} · {formatCount(v.followers)} followers
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
        ))}
      </BoxHScroll>
    </Box>
  );
}

// ── 6. Menu ─────────────────────────────────────────────────────────────

function MenuBox({ venue }: { venue: VenueDetail }) {
  return (
    <Box title="Menu">
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
              <div className={cn("absolute inset-x-0 top-0 h-1", TIER_AVATAR_BG[tier])} />
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
    ["Price range", venue.details.price_range],
    ["Dress code", venue.details.dress_code],
    ["Payment", venue.details.payment],
    ["Parking", venue.details.parking],
    ["Access", venue.details.access],
  ];
  return (
    <Box title="Good to know">
      <div className="bg-background flex flex-col divide-y divide-white/5 rounded-xl">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-start justify-between gap-4 px-3 py-2.5"
          >
            <span className="text-muted-foreground text-xs">{label}</span>
            <span className="text-foreground text-right text-sm font-medium">
              {value}
            </span>
          </div>
        ))}
      </div>
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

// ── Helpers ─────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}
