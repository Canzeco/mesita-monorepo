"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CreditCard,
  Loader2,
  Percent,
  Sparkles,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateVenue, type MyVenue } from "@/lib/api/venues";
import type { Tier } from "@/lib/guest-data";
import { Badge } from "@/components/ui/badge";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import {
  PLANS,
  visibilityForPlan,
  displayPlanForVenue,
  dbPlanForSelection,
  type DisplayPlanId,
  type PlanVisibility,
} from "@/lib/manager/plans";

// Promos — minimal layout. Four blocks stacked top to bottom:
//   1. Visibility   — slim 5-step rail, no prose
//   2. Plan         — Free vs Pro, 2 lines per card
//   3. Mechanic     — Cashback vs Discount, 1 line per card
//   4. Promos       — Welcome row + 4 tier rows; rate + audience count
//   5. Advanced     — coming-soon pill
//
// "OFF" is the neutral label for the rate scale — same wording whether the
// venue runs cashback or discount.

// ─── Rate picker scale ────────────────────────────────────────────────────

const RATE_CHOICES = [5, 10, 20, 50] as const;
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
  { id: "bronze", label: "Bronze", visitRange: "0–2 visits", defaultRate: 5, onMesita: 18_420 },
  { id: "silver", label: "Silver", visitRange: "3–6 visits", defaultRate: 10, onMesita: 6_240 },
  { id: "gold", label: "Gold", visitRange: "7–19 visits", defaultRate: 20, onMesita: 1_860 },
  { id: "diamond", label: "Diamond", visitRange: "20+ visits", defaultRate: 30 as RateChoice, onMesita: 184 },
];

// ─── Client ───────────────────────────────────────────────────────────────

export function PromosClient({ venue }: { venue: MyVenue }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const [pending, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [fiscalPending, startFiscalSave] = useTransition();
  const [fiscalError, setFiscalError] = useState<string | null>(null);
  const switchFiscal = (next: "formal" | "informal") => {
    if (next === venue.fiscal_type || fiscalPending) return;
    setFiscalError(null);
    startFiscalSave(async () => {
      try {
        await apiUpdateVenue(supabase, { id: venue.id, fiscal_type: next });
        router.refresh();
      } catch (err) {
        setFiscalError(errMsg(err, "Couldn't save."));
      }
    });
  };

  const currentDisplayPlan: DisplayPlanId = displayPlanForVenue(venue.plan);
  const [pendingPlanId, setPendingPlanId] = useState<DisplayPlanId | null>(null);

  const selectPlan = (target: DisplayPlanId) => {
    if (target === currentDisplayPlan || pending) return;
    const dbPlan = dbPlanForSelection(target, venue.fiscal_type);
    if (dbPlan === venue.plan) return;
    setError(null);
    setPendingPlanId(target);
    startSubmit(async () => {
      try {
        await apiUpdateVenue(supabase, { id: venue.id, plan: dbPlan });
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save the plan."));
      } finally {
        setPendingPlanId(null);
      }
    });
  };

  const [basicEnabled, setBasicEnabled] = useState(venue.segmentation_basic_enabled);
  const [advancedEnabled, setAdvancedEnabled] = useState(venue.segmentation_advanced_enabled);
  const writeToggle = (
    field: "segmentation_basic_enabled" | "segmentation_advanced_enabled",
    next: boolean,
    rollback: () => void,
  ) => {
    apiUpdateVenue(supabase, { id: venue.id, [field]: next })
      .then(() => router.refresh())
      .catch((err) => {
        rollback();
        setError(errMsg(err, "Couldn't save the toggle."));
      });
  };
  const handleBasicToggle = (next: boolean) => {
    setBasicEnabled(next);
    writeToggle("segmentation_basic_enabled", next, () => setBasicEnabled(!next));
  };
  const handleAdvancedToggle = (next: boolean) => {
    setAdvancedEnabled(next);
    writeToggle("segmentation_advanced_enabled", next, () => setAdvancedEnabled(!next));
  };

  const isFree = venue.plan === "free";

  return (
    <div className="flex flex-col gap-4">
      <VisibilityRail plan={venue.plan} />

      <Section title="Plan">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PLANS.map((p) => {
            const isCurrent = p.id === currentDisplayPlan;
            const isPending = pendingPlanId === p.id;
            return (
              <PlanCard
                key={p.id}
                label={p.label}
                price={p.price}
                cadence={p.cadence}
                tagline={p.id === "free" ? "Listed on Mesita." : "Listed + promos + IG verification."}
                featured={!!p.featured}
                isCurrent={isCurrent}
                pending={isPending}
                onPick={() => selectPlan(p.id)}
              />
            );
          })}
        </div>
        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
        {isFree && (
          <p className="text-muted-foreground text-xs">
            On <span className="text-foreground font-semibold">Free</span> your
            promos save but won&apos;t go live until you upgrade.
          </p>
        )}
      </Section>

      <Section title="Reward">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MechanicCard
            tone="cashback"
            isCurrent={venue.fiscal_type === "formal"}
            pending={fiscalPending}
            onPick={() => switchFiscal("formal")}
          />
          <MechanicCard
            tone="discount"
            isCurrent={venue.fiscal_type === "informal"}
            pending={fiscalPending}
            onPick={() => switchFiscal("informal")}
          />
        </div>
        {fiscalError && <p className={ERROR_BOX_CLASS}>{fiscalError}</p>}
      </Section>

      <Section
        title="Promos"
        enabled={basicEnabled}
        onEnabledChange={handleBasicToggle}
      >
        <WelcomeRow />
        <div className="flex flex-col gap-1.5">
          {TIERS.map((t) => (
            <TierRow key={t.id} tier={t} />
          ))}
        </div>
      </Section>

      <Section
        title="Advanced"
        enabled={advancedEnabled}
        onEnabledChange={handleAdvancedToggle}
      >
        <AdvancedComingSoon />
      </Section>
    </div>
  );
}

// ─── Visibility rail ──────────────────────────────────────────────────────

function VisibilityRail({ plan }: { plan: Parameters<typeof visibilityForPlan>[0] }) {
  const current = visibilityForPlan(plan);
  const levels: { label: PlanVisibility | string; soon?: boolean; real?: PlanVisibility }[] = [
    { label: "Minimum", real: "Minimum" },
    { label: "Priority", real: "Priority" },
    { label: "Maximum", real: "Maximum" },
    { label: "Featured", soon: true },
    { label: "Spotlight", soon: true },
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

// ─── Plan card ────────────────────────────────────────────────────────────

function PlanCard({
  label,
  price,
  cadence,
  tagline,
  featured,
  isCurrent,
  pending,
  onPick,
}: {
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  featured: boolean;
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
      <div className="flex items-baseline gap-2">
        <span className="font-display text-xl font-semibold tracking-tight">
          {label}
        </span>
        <span className="font-display text-foreground text-lg font-bold tabular-nums leading-none">
          {price}
        </span>
        <span className="text-muted-foreground text-[11px]">{cadence}</span>
      </div>
      <p className="text-muted-foreground text-[12px] leading-snug">{tagline}</p>
      {pending && (
        <Loader2 className="text-muted-foreground absolute right-3 bottom-3 h-4 w-4 animate-spin" />
      )}
    </button>
  );
}

// ─── Mechanic card ────────────────────────────────────────────────────────

function MechanicCard({
  tone,
  isCurrent,
  pending,
  onPick,
}: {
  tone: "cashback" | "discount";
  isCurrent: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  const meta =
    tone === "cashback"
      ? {
          label: "Cashback",
          tagline: "Card runs through Mesita. We return part to the guest's wallet.",
          Icon: CreditCard,
          accent: "bg-pink-gradient text-white",
        }
      : {
          label: "Discount",
          tagline: "Guest shows the coupon, you discount the bill. Mesita stays out.",
          Icon: Percent,
          accent: "bg-tier-gold text-black",
        };
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isCurrent || pending}
      className={cn(
        "border-border bg-card relative flex items-start gap-3 rounded-2xl border p-4 text-left transition disabled:cursor-default",
        !isCurrent && "hover:border-foreground/30",
        isCurrent && "border-foreground shadow-elev",
      )}
    >
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          meta.accent,
        )}
      >
        <meta.Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-display text-base font-semibold tracking-tight">
            {meta.label}
          </span>
          {isCurrent && (
            <Check className="text-foreground h-3.5 w-3.5" />
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 text-[12px] leading-snug">
          {meta.tagline}
        </p>
      </div>
      {pending && !isCurrent && (
        <Loader2 className="text-muted-foreground h-4 w-4 shrink-0 animate-spin" />
      )}
    </button>
  );
}

// ─── Welcome row + Tier rows ──────────────────────────────────────────────

function WelcomeRow() {
  const [rate, setRate] = useState<RateChoice>(20);
  return (
    <PromoRow
      chip={
        <span className="bg-welcome-gradient inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase">
          Welcome
        </span>
      }
      sub="First visit"
      rate={rate}
      onRate={setRate}
      audience={12_480}
      audienceLabel="Nearby"
    />
  );
}

function TierRow({ tier }: { tier: TierMeta }) {
  const initial: RateChoice = (RATE_CHOICES.find((r) => r >= tier.defaultRate) ?? 50) as RateChoice;
  const [rate, setRate] = useState<RateChoice>(initial);
  return (
    <PromoRow
      chip={<TierChip tier={tier.id} label={tier.label} />}
      sub={tier.visitRange}
      rate={rate}
      onRate={setRate}
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
  audience,
  audienceLabel,
}: {
  chip: React.ReactNode;
  sub: string;
  rate: RateChoice;
  onRate: (next: RateChoice) => void;
  audience: number;
  audienceLabel: string;
}) {
  return (
    <div className="border-border bg-card grid grid-cols-[120px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        {chip}
        <span className="text-muted-foreground text-[10px]">{sub}</span>
      </div>
      <RatePicker rate={rate} onChange={onRate} />
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
}: {
  rate: RateChoice;
  onChange: (next: RateChoice) => void;
}) {
  return (
    <div className="flex items-center gap-2">
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
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-semibold transition",
              c === rate
                ? "bg-pink-gradient text-white"
                : "border-border bg-background text-muted-foreground hover:text-foreground border",
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

// ─── Section card + toggle switch ─────────────────────────────────────────

function Section({
  title,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  enabled?: boolean;
  onEnabledChange?: (next: boolean) => void;
  children: React.ReactNode;
}) {
  const hasToggle = onEnabledChange !== undefined;
  const showChildren = !hasToggle || enabled !== false;
  return (
    <section className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h3>
        {hasToggle && (
          <Switch
            checked={enabled ?? false}
            onCheckedChange={onEnabledChange}
            label={`Enable ${title.toLowerCase()}`}
          />
        )}
      </div>
      {showChildren && children}
    </section>
  );
}

function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-pink-gradient" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-5" : "translate-x-1",
        )}
      />
    </button>
  );
}
