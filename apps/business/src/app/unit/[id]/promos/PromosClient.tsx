"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CreditCard,
  Loader2,
  Percent,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateVenue, type MyVenue } from "@/lib/api/venues";
import type { Tier } from "@/lib/guest-data";
import { Badge } from "@/components/ui/badge";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import {
  SUBSCRIPTIONS,
  subscriptionForVenue,
  dbStateForSubscription,
  visibilityForPlan,
  type SubscriptionId,
  type PlanVisibility,
} from "@/lib/manager/plans";

// Promos — minimal layout. Three blocks stacked top to bottom:
//   1. Visibility    — slim 5-step rail, no prose
//   2. Subscription  — Free / Cashback / Discount, one card per DB state
//   3. Promos        — Welcome row + 4 tier rows; rate + audience count
//   4. Advanced      — coming-soon pill
//
// "OFF" is the neutral label for the rate scale — same wording whether the
// venue runs cashback or discount.

// ─── Rate picker scale ────────────────────────────────────────────────────

const RATE_CHOICES = [0, 10, 20, 50] as const;
type RateChoice = (typeof RATE_CHOICES)[number];

// ─── Tier ladder catalog ──────────────────────────────────────────────────

type TierMeta = {
  id: Tier;
  label: string;
  visitRange: string;
  defaultRate: RateChoice;
  onMesita: number;
};

const TIERS: TierMeta[] = [
  { id: "bronze", label: "Bronze", visitRange: "0–2 visits", defaultRate: 10, onMesita: 18_420 },
  { id: "silver", label: "Silver", visitRange: "3–6 visits", defaultRate: 10, onMesita: 6_240 },
  { id: "gold", label: "Gold", visitRange: "7–19 visits", defaultRate: 20, onMesita: 1_860 },
  { id: "diamond", label: "Diamond", visitRange: "20+ visits", defaultRate: 30 as RateChoice, onMesita: 184 },
];

// ─── Subscription icons + accents ─────────────────────────────────────────

const SUB_VISUAL: Record<
  SubscriptionId,
  { icon?: LucideIcon; accent?: string }
> = {
  free: {},
  cashback: { icon: CreditCard, accent: "bg-pink-gradient text-white" },
  discount: { icon: Percent, accent: "bg-tier-gold text-black" },
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
        <WelcomeRow disabled={isFree} />
        <div className="flex flex-col gap-1.5">
          {TIERS.map((t) => (
            <TierRow key={t.id} tier={t} disabled={isFree} />
          ))}
        </div>
      </Section>

      <Section title="Advanced">
        <AdvancedComingSoon />
      </Section>
    </div>
  );
}

// ─── Visibility rail ──────────────────────────────────────────────────────

function VisibilityRail({ plan }: { plan: Parameters<typeof visibilityForPlan>[0] }) {
  const current = visibilityForPlan(plan);
  const levels: { label: string; soon?: boolean; real?: PlanVisibility }[] = [
    { label: "Low", real: "Low" },
    { label: "Medium", real: "Medium" },
    { label: "High", real: "High" },
    { label: "Extra high", soon: true },
    { label: "Max", soon: true },
  ];
  const currentIdx = levels.findIndex((l) => l.real === current);

  return (
    <section className="border-border bg-card rounded-2xl border p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          Visibility
        </h3>
        <span className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
          {current}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {levels.map((l, i) => {
          const reached = !l.soon && i <= currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <div key={l.label} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className={cn(
                  "h-1.5 w-full rounded-full",
                  reached
                    ? "bg-pink-gradient"
                    : l.soon
                      ? "bg-muted/60"
                      : "bg-muted",
                )}
              />
              <span
                className={cn(
                  "text-[9px] font-semibold tracking-wider uppercase",
                  isCurrent
                    ? "text-foreground"
                    : l.soon
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground",
                )}
              >
                {l.label}
              </span>
            </div>
          );
        })}
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
  icon?: LucideIcon;
  iconAccent?: string;
  isCurrent: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isCurrent || pending}
      className={cn(
        "border-border bg-card relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition disabled:cursor-default",
        !isCurrent && "hover:border-foreground/30",
        isCurrent && "border-foreground shadow-elev",
        featured && !isCurrent && "bg-pink-gradient/[0.04]",
      )}
    >
      {isCurrent && (
        <Badge className="bg-foreground text-background absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          Current
        </Badge>
      )}
      {!isCurrent && featured && (
        <Badge className="bg-pink-gradient absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
          Recommended
        </Badge>
      )}
      <div className="flex items-center gap-2 pr-16">
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
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-foreground text-lg font-bold tabular-nums leading-none">
          {price}
        </span>
        <span className="text-muted-foreground text-[11px]">{cadence}</span>
      </div>
      <p className="text-muted-foreground text-[12px] leading-snug">{tagline}</p>
      <div className="mt-auto flex flex-col gap-0.5">
        <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
          {visibility} visibility
        </p>
        {setup && (
          <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
            {setup} setup
          </p>
        )}
      </div>
      {pending && (
        <Loader2 className="text-muted-foreground absolute right-3 bottom-3 h-4 w-4 animate-spin" />
      )}
    </button>
  );
}

// ─── Welcome row + Tier rows ──────────────────────────────────────────────

function WelcomeRow({ disabled }: { disabled: boolean }) {
  const [rate, setRate] = useState<RateChoice>(20);
  return (
    <PromoRow
      chip={
        <span className="bg-welcome-gradient inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
          Welcome
        </span>
      }
      sub="First visit"
      rate={disabled ? 0 : rate}
      onRate={setRate}
      disabled={disabled}
      audience={12_480}
      audienceLabel="Nearby"
    />
  );
}

function TierRow({ tier, disabled }: { tier: TierMeta; disabled: boolean }) {
  const initial: RateChoice = (RATE_CHOICES.find((r) => r >= tier.defaultRate) ?? 50) as RateChoice;
  const [rate, setRate] = useState<RateChoice>(initial);
  return (
    <PromoRow
      chip={<TierChip tier={tier.id} label={tier.label} />}
      sub={tier.visitRange}
      rate={disabled ? 0 : rate}
      onRate={setRate}
      disabled={disabled}
      audience={tier.onMesita}
      audienceLabel="On Mesita"
    />
  );
}

function PromoRow({
  chip,
  sub,
  rate,
  onRate,
  disabled,
  audience,
  audienceLabel,
}: {
  chip: React.ReactNode;
  sub: string;
  rate: RateChoice;
  onRate: (next: RateChoice) => void;
  disabled: boolean;
  audience: number;
  audienceLabel: string;
}) {
  return (
    <div className="border-border bg-card grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        {chip}
        <span className="text-muted-foreground text-[10px]">{sub}</span>
      </div>
      <RatePicker rate={rate} onChange={onRate} disabled={disabled} />
      <div className="text-right">
        <p className="font-display text-sm font-bold tabular-nums leading-none">
          {audience.toLocaleString()}
        </p>
        <p className="text-muted-foreground mt-0.5 text-[9px] font-medium tracking-[0.12em] uppercase">
          {audienceLabel}
        </p>
      </div>
    </div>
  );
}

function RatePicker({
  rate,
  onChange,
  disabled,
}: {
  rate: RateChoice;
  onChange: (next: RateChoice) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2", disabled && "opacity-60")}>
      <span className="font-display text-primary text-2xl font-bold tabular-nums leading-none">
        {rate}
        <span className="text-base font-semibold">%</span>
      </span>
      <div className="flex flex-wrap gap-1">
        {RATE_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            disabled={disabled}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
              c === rate
                ? "bg-pink-gradient text-white"
                : "border-border bg-background text-muted-foreground hover:text-foreground border",
              disabled && "cursor-not-allowed hover:text-muted-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

const TIER_TONE: Record<Tier, string> = {
  bronze: "bg-tier-bronze text-white",
  silver: "bg-tier-silver text-foreground",
  gold: "bg-tier-gold text-black",
  diamond: "bg-tier-diamond text-white",
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

// ─── Advanced (coming soon) ───────────────────────────────────────────────

function AdvancedComingSoon() {
  return (
    <div className="border-border bg-muted/30 flex items-center justify-center gap-2 rounded-xl border border-dashed p-5">
      <Sparkles className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-muted-foreground text-[12px]">
        Custom rates per group — coming soon.
      </span>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <h3 className="font-display text-sm font-semibold tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}
