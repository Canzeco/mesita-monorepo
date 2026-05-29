"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Loader2,
  Lock,
  Percent,
  type LucideIcon,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateVenue, type MyVenue } from "@/lib/api/venues";
import { Badge } from "@/components/ui/badge";
import { Section } from "@/components/shared";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import {
  SUBSCRIPTIONS,
  subscriptionForVenue,
  dbStateForSubscription,
  visibilityForPlan,
  type SubscriptionId,
  type PlanVisibility,
} from "@/lib/business/plans";

// Promos — minimal layout. Three blocks stacked top to bottom:
//   1. Visibility    — slim 5-step rail (Low → Max), no prose
//   2. Subscription  — Free + Pro/Ultra × Discount/Cashback, one card per DB state
//   3. Promos        — Welcome row + 4 tier rows; rate + audience count
//
// "OFF" is the neutral label for the rate scale — same wording whether the
// venue runs cashback or discount.

// ─── Rate picker scale ────────────────────────────────────────────────────

// Four per-tier promo rates land in the venues table as smallint columns
// constrained to this set (or null). See migration 0032. Zero is no longer
// a legal value — to "turn off" a tier, write null.
const RATE_CHOICES = [10, 20, 50, 70] as const;
type RateChoice = (typeof RATE_CHOICES)[number];

// ─── Tier ladder catalog ──────────────────────────────────────────────────

type Tier = "free" | "premium";

// Each cell maps to one of the four DB columns: `welcome_<tier>_rate`
// (first visit at the venue) or `<tier>_rate` (every visit afterwards).
type PromoColumn =
  | "welcome_free_rate"
  | "welcome_premium_rate"
  | "free_rate"
  | "premium_rate";

const TIER_LABEL: Record<Tier, string> = {
  free: "Free",
  premium: "Premium",
};

// ─── Subscription icons + accents ─────────────────────────────────────────

// Mechanic icon + accent — Discount tiers get the gold percent badge,
// Cashback tiers get the pink-gradient card badge. Pro vs Ultra is
// communicated through price/visibility on the card, not a separate icon.
const SUB_VISUAL: Record<
  SubscriptionId,
  { icon?: LucideIcon; accent?: string }
> = {
  free: {},
  pro_discount: { icon: Percent, accent: "bg-tier-gold text-black" },
  pro_cashback: { icon: CreditCard, accent: "bg-pink-gradient text-white" },
  ultra_discount: { icon: Percent, accent: "bg-tier-gold text-black" },
  ultra_cashback: { icon: CreditCard, accent: "bg-pink-gradient text-white" },
};

// ─── Client ───────────────────────────────────────────────────────────────

export function PromosClient({ venue }: { venue: MyVenue }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const [pending, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const currentSub: SubscriptionId = subscriptionForVenue(venue.plan);
  const [pendingSubId, setPendingSubId] = useState<SubscriptionId | null>(null);

  const selectSubscription = (target: SubscriptionId) => {
    if (target === currentSub || pending) return;
    // Locked tiers (e.g. cashback while the payment loop is being built)
    // render disabled in the picker, but guard here too so a stray click
    // from a stale render can't bypass it.
    const row = SUBSCRIPTIONS.find((s) => s.id === target);
    if (row?.comingSoon) return;
    setError(null);
    setPendingSubId(target);
    startSubmit(async () => {
      try {
        const dbState = dbStateForSubscription(target);
        await apiUpdateVenue(supabase, { id: venue.id, ...dbState });
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save the subscription."));
      } finally {
        setPendingSubId(null);
      }
    });
  };

  const isFree = currentSub === "free";

  return (
    <div className="flex flex-col gap-4">
      <VisibilityRail plan={venue.plan} />

      <Section title="Subscription">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SUBSCRIPTIONS.map((s) => {
            const v = SUB_VISUAL[s.id];
            return (
              <SubscriptionCard
                key={s.id}
                label={s.label}
                price={s.price}
                cadence={s.cadence}
                tagline={s.tagline}
                visibility={s.visibility}
                setup={s.setup}
                featured={!!s.featured}
                comingSoon={!!s.comingSoon}
                icon={v.icon}
                iconAccent={v.accent}
                isCurrent={s.id === currentSub}
                pending={pendingSubId === s.id}
                onPick={() => selectSubscription(s.id)}
              />
            );
          })}
        </div>
        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
        {isFree && (
          <p className="text-muted-foreground text-xs">
            On <span className="text-foreground font-semibold">Free</span> rates
            are locked to 0% — pick Discounts or Cashbacks to set them.
          </p>
        )}
      </Section>

      <Section title="Promos">
        <div className="grid grid-cols-2 gap-2">
          <ColumnHeader>First visit</ColumnHeader>
          <ColumnHeader>Returning visits</ColumnHeader>
          {(["free", "premium"] as const).flatMap((tier) => [
            <PromoCell
              key={`welcome-${tier}`}
              column={`welcome_${tier}_rate` as PromoColumn}
              tier={tier}
              initial={venue[`welcome_${tier}_rate`]}
              venueId={venue.id}
              disabled={isFree}
            />,
            <PromoCell
              key={`default-${tier}`}
              column={`${tier}_rate` as PromoColumn}
              tier={tier}
              initial={venue[`${tier}_rate`]}
              venueId={venue.id}
              disabled={isFree}
            />,
          ])}
        </div>
      </Section>
    </div>
  );
}

function ColumnHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
      {children}
    </p>
  );
}

// ─── Visibility rail ──────────────────────────────────────────────────────

// Visibility rail. Five levels (Low → Max). Mesita shows higher-plan
// venues to more guests on every discovery surface (swipe, catalog,
// map), so the business needs to see at a glance where their plan lands
// on the ladder. Previous design used 5 × 2 paired bars; the redesign
// drops to one stepped dot-ladder with the current node ringed + a
// big "Step X of 5 · <label>" headline so the answer is immediate.

function VisibilityRail({
  plan,
}: {
  plan: Parameters<typeof visibilityForPlan>[0];
}) {
  const current = visibilityForPlan(plan);
  const levels: { label: string; real: PlanVisibility }[] = [
    { label: "Low", real: "Low" },
    { label: "Medium", real: "Medium" },
    { label: "High", real: "High" },
    { label: "Extra high", real: "Extra high" },
    { label: "Max", real: "Max" },
  ];
  const currentIdx = levels.findIndex((l) => l.real === current);

  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          Visibility
        </h3>
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Step {currentIdx + 1} of {levels.length}
        </span>
      </div>
      <p className="font-display text-foreground mt-1 text-2xl font-semibold leading-none tracking-tight">
        {current}
      </p>

      <div className="mt-5 flex items-center">
        {levels.map((l, i) => {
          const reached = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <Fragment key={l.label}>
              {i > 0 && (
                <div
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i <= currentIdx ? "bg-pink-gradient" : "bg-muted",
                  )}
                />
              )}
              <div
                className={cn(
                  "shrink-0 rounded-full transition",
                  isCurrent
                    ? "bg-pink-gradient shadow-glow ring-pink-500/30 h-4 w-4 ring-4"
                    : reached
                      ? "bg-pink-gradient h-3 w-3"
                      : "bg-muted h-3 w-3",
                )}
              />
            </Fragment>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[9px] font-semibold tracking-wider uppercase">
        {levels.map((l, i) => (
          <span
            key={l.label}
            className={cn(
              i === currentIdx ? "text-foreground" : "text-muted-foreground/70",
            )}
          >
            {l.label}
          </span>
        ))}
      </div>
    </section>
  );
}

// ─── Subscription card ────────────────────────────────────────────────────

function SubscriptionCard({
  label,
  price,
  cadence,
  tagline,
  visibility,
  setup,
  featured,
  comingSoon,
  icon: Icon,
  iconAccent,
  isCurrent,
  pending,
  onPick,
}: {
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  visibility: PlanVisibility;
  setup?: string;
  featured: boolean;
  comingSoon: boolean;
  icon?: LucideIcon;
  iconAccent?: string;
  isCurrent: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  // Locked tiers stay visible (so the visibility ladder still makes
  // sense), but the button can't fire and the badge tells the business
  // why. We keep the soft pink wash from `featured` so the card still
  // reads as the aspirational top of the ladder.
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isCurrent || pending || comingSoon}
      aria-disabled={comingSoon || undefined}
      title={comingSoon ? "Coming soon" : undefined}
      className={cn(
        "border-border bg-card relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition disabled:cursor-default",
        !isCurrent && !comingSoon && "hover:border-foreground/30",
        isCurrent && "border-foreground shadow-elev",
        featured && !isCurrent && "bg-pink-gradient/[0.04]",
        comingSoon && "cursor-not-allowed",
      )}
    >
      {isCurrent && (
        <Badge className="bg-foreground text-background absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          Current
        </Badge>
      )}
      {!isCurrent && comingSoon && (
        <Badge className="bg-muted text-muted-foreground border-border absolute top-3 right-3 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          <Lock className="h-2.5 w-2.5" />
          Coming soon
        </Badge>
      )}
      {!isCurrent && !comingSoon && featured && (
        <Badge className="bg-pink-gradient absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
          Recommended
        </Badge>
      )}
      <div
        className={cn(
          "flex items-center gap-2 pr-16",
          comingSoon && "opacity-70",
        )}
      >
        {Icon && (
          <span
            className={cn(
              "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              iconAccent,
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="font-display min-w-0 truncate text-base font-semibold tracking-tight">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "flex items-baseline gap-1.5",
          comingSoon && "opacity-70",
        )}
      >
        <span className="font-display text-foreground text-lg leading-none font-bold tabular-nums">
          {price}
        </span>
        <span className="text-muted-foreground text-[11px]">{cadence}</span>
      </div>
      <p
        className={cn(
          "text-muted-foreground text-[12px] leading-snug",
          comingSoon && "opacity-70",
        )}
      >
        {tagline}
      </p>
      <div className="mt-auto flex flex-col gap-0.5">
        <p
          className={cn(
            "text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase",
            comingSoon && "opacity-70",
          )}
        >
          {visibility} visibility
        </p>
        {setup && !comingSoon && (
          <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
            {setup} setup
          </p>
        )}
        {comingSoon && (
          <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
            Available soon
          </p>
        )}
      </div>
      {pending && (
        <Loader2 className="text-muted-foreground absolute right-3 bottom-3 h-4 w-4 animate-spin" />
      )}
    </button>
  );
}

// ─── Promo cell ───────────────────────────────────────────────────────────

// One cell in the 2-column grid. Owns the local state for its DB column
// and persists each pick through apiUpdateVenue (optimistic — reverts on
// failure). Same tier chip colors across both columns (Free cool gray,
// Premium violet) — the "First visit" vs "Every visit" distinction lives
// in the column header above, not in the chip styling.
function PromoCell({
  column,
  tier,
  initial,
  venueId,
  disabled,
}: {
  column: PromoColumn;
  tier: Tier;
  initial: number | null;
  venueId: string;
  disabled: boolean;
}) {
  const supabase = useBrowserSupabase();
  const [rate, setRate] = useState<RateChoice | null>(
    initial as RateChoice | null,
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = (next: RateChoice | null) => {
    if (disabled || pending) return;
    const previous = rate;
    setRate(next);
    setPending(true);
    setError(null);
    void apiUpdateVenue(supabase, { id: venueId, [column]: next })
      .catch((err) => {
        setRate(previous);
        setError(errMsg(err, "Couldn't save."));
      })
      .finally(() => setPending(false));
  };

  const displayRate = disabled ? null : rate;
  return (
    <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-baseline justify-between gap-2">
        <TierChip tier={tier} label={TIER_LABEL[tier]} />
        <span className="font-display text-primary text-xl leading-none font-bold tabular-nums">
          {displayRate ?? "—"}
          {displayRate != null && (
            <span className="text-sm font-semibold">%</span>
          )}
        </span>
      </div>
      <div className="flex flex-wrap gap-1">
        <RatePill
          label="Off"
          active={displayRate == null}
          disabled={disabled || pending}
          onClick={() => onPick(null)}
        />
        {RATE_CHOICES.map((c) => (
          <RatePill
            key={c}
            label={String(c)}
            active={c === displayRate}
            disabled={disabled || pending}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
      {error && <p className="text-destructive text-[10px]">{error}</p>}
    </div>
  );
}

function RatePill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
        active && label === "Off"
          ? "bg-foreground text-background"
          : active
            ? "bg-pink-gradient text-white"
            : "border-border bg-background text-muted-foreground hover:text-foreground border",
        disabled && "cursor-not-allowed opacity-60 hover:text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}

const TIER_TONE: Record<Tier, string> = {
  free: "bg-tier-free text-foreground",
  premium: "bg-tier-premium text-white",
};

function TierChip({ tier, label }: { tier: Tier; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase",
        TIER_TONE[tier],
      )}
    >
      {label}
    </span>
  );
}
