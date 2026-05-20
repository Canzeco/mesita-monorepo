"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  CircleDollarSign,
  CreditCard,
  Filter,
  GraduationCap,
  Instagram,
  Loader2,
  MapPin,
  Percent,
  Sparkles,
  Users,
} from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateVenue, type MyVenue, type VenuePlan } from "@/lib/api/venues";
import { TicketTypesCard } from "@/components/manager/TicketTypesCard";
import { cn } from "@/lib/utils";
import { PLANS, mechanicForPlan } from "@/lib/manager/plans";

// Promos owns three layers of configuration in one page:
//   1. Plan — pick Free / Formal Pro / Informal Pro + fiscal-type toggle.
//   2. Ticket types — the audit-log reference enabled by the plan.
//   3. Segmentation — Welcome coupon for first-time guests and per-tier
//      cashback/discount rates for returning ones. Advanced axes
//      (communities, demographics, geography, custom rules) land later.

// ─── Rate picker scale ────────────────────────────────────────────────────

const RATE_CHOICES = [5, 10, 20, 50] as const;
type RateChoice = (typeof RATE_CHOICES)[number];

// ─── Tier ladder catalog ──────────────────────────────────────────────────

type TierId = "bronze" | "silver" | "gold" | "diamond";

type TierMeta = {
  id: TierId;
  label: string;
  visitRange: string;
  defaultRate: RateChoice;
  estPerWeek: number;
  onMesita: number;
  source: string;
  handles: string[];
  overflowHandles: number;
  publicPool?: boolean;
};

const TIERS: TierMeta[] = [
  {
    id: "bronze",
    label: "Bronze",
    visitRange: "0 – 2 visits",
    defaultRate: 5,
    estPerWeek: 6,
    onMesita: 18_420,
    source: "Everyone",
    handles: [],
    overflowHandles: 0,
    publicPool: true,
  },
  {
    id: "silver",
    label: "Silver",
    visitRange: "3 – 6 visits",
    defaultRate: 10,
    estPerWeek: 12,
    onMesita: 6_240,
    source: "1K+ followers",
    handles: ["@sofip", "@renatak", "@tomasl"],
    overflowHandles: 0,
  },
  {
    id: "gold",
    label: "Gold",
    visitRange: "7 – 19 visits",
    defaultRate: 20,
    estPerWeek: 24,
    onMesita: 1_860,
    source: "5K+ followers",
    handles: ["@valenrose", "@lucasm", "@camivb"],
    overflowHandles: 2,
  },
  {
    id: "diamond",
    label: "Diamond",
    visitRange: "20+ visits",
    defaultRate: 30 as RateChoice,
    estPerWeek: 36,
    onMesita: 184,
    source: "20K+ followers · invite-only",
    handles: ["@valenrose", "@camivb", "@anat"],
    overflowHandles: 1,
  },
];

// ─── Client ───────────────────────────────────────────────────────────────

export function PromosClient({ venue }: { venue: MyVenue }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabase(), []);

  const [plan, setPlan] = useState<VenuePlan>(venue.plan);
  const [pending, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
        setFiscalError(err instanceof Error ? err.message : "Couldn't save.");
      }
    });
  };

  const isFormal = venue.fiscal_type === "formal";
  const mechanic = mechanicForPlan(plan);
  const savedMechanic = mechanicForPlan(venue.plan);

  const planFiscalScope = useMemo(() => {
    const meta = PLANS.find((p) => p.id === plan);
    return meta?.fiscalScope ?? "any";
  }, [plan]);
  const fiscalMismatch =
    planFiscalScope !== "any" &&
    ((isFormal && planFiscalScope === "informal") ||
      (!isFormal && planFiscalScope === "formal"));

  const submit = () => {
    if (plan === venue.plan) return;
    setError(null);
    setSaved(false);
    startSubmit(async () => {
      try {
        await apiUpdateVenue(supabase, { id: venue.id, plan });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Couldn't save the plan.",
        );
      }
    });
  };

  const mechanicLabel = savedMechanic === "Discount" ? "Discount" : "Cashback";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Plan ─────────────────────────────────────────────────────── */}
      <section className="border-border bg-card rounded-2xl border shadow-sm">
        <header className="border-border flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-secondary text-[10px] font-bold tracking-[0.18em] uppercase">
              Plan
            </p>
            <h2 className="font-display mt-0.5 text-xl font-semibold tracking-tight">
              Pick a plan
            </h2>
          </div>
          <FiscalSegmentedToggle
            current={venue.fiscal_type}
            pending={fiscalPending}
            onSwitch={switchFiscal}
          />
        </header>

        {fiscalError && (
          <p className="border-border bg-destructive/5 text-destructive border-b px-6 py-2 text-xs">
            {fiscalError}
          </p>
        )}

        <ul className="divide-border divide-y">
          {PLANS.map((p) => {
            const selected = plan === p.id;
            const currentlyActive = venue.plan === p.id;
            const scope = p.fiscalScope;
            const wrongFiscal =
              scope !== "any" &&
              ((isFormal && scope === "informal") ||
                (!isFormal && scope === "formal"));
            return (
              <PlanRow
                key={p.id}
                plan={p}
                selected={selected}
                currentlyActive={currentlyActive}
                wrongFiscal={wrongFiscal}
                onSelect={() => setPlan(p.id)}
              />
            );
          })}
        </ul>

        <div className="border-border flex flex-col gap-3 border-t px-6 py-5">
          <PaymentRailLine isFormal={isFormal} />

          {fiscalMismatch && (
            <p className="border-destructive/40 bg-destructive/5 text-destructive flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                The plan you picked doesn&apos;t match your fiscal type. Switch
                fiscal at the top or pick a matching plan — otherwise tickets
                refuse to open.
              </span>
            </p>
          )}

          {(error || saved) && (
            <p
              className={cn(
                "rounded-lg px-3 py-2 text-xs",
                error
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary/10 text-secondary",
              )}
            >
              {error ?? "Plan saved."}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={submit}
              disabled={pending || plan === venue.plan || fiscalMismatch}
              className="bg-pink-gradient shadow-glow inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {plan === venue.plan ? "Saved" : "Save plan"}
            </button>
          </div>
        </div>
      </section>

      <TicketTypesCard isFormal={isFormal} planMechanic={mechanic} />

      {savedMechanic === "None" && (
        <FreePlanBanner fiscalType={venue.fiscal_type} />
      )}

      {/* ── Segmentation ────────────────────────────────────────────── */}
      <SegmentationGroup
        kind="basic"
        title="Basic segmentation"
        blurb="Two levers every venue gets: a Welcome coupon for first-time guests and per-tier rates for returning ones."
      >
        <FirstTimeSection mechanicLabel={mechanicLabel} />
        <ReturningTierGrid mechanicLabel={mechanicLabel} />
      </SegmentationGroup>

      <SegmentationGroup
        kind="advanced"
        title="Advanced segmentation"
        blurb="Stack extra dimensions on top of the basic tier rates — communities, demographics, geography, custom rules. All landing with the segments table."
      >
        <AdvancedSegmentationGrid />
      </SegmentationGroup>
    </div>
  );
}

// ─── Plan row ─────────────────────────────────────────────────────────────

function PlanRow({
  plan,
  selected,
  currentlyActive,
  wrongFiscal,
  onSelect,
}: {
  plan: (typeof PLANS)[number];
  selected: boolean;
  currentlyActive: boolean;
  wrongFiscal: boolean;
  onSelect: () => void;
}) {
  const MechanicIcon =
    plan.mechanic === "Cashback"
      ? CircleDollarSign
      : plan.mechanic === "Discount"
        ? Percent
        : Sparkles;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-4 px-6 py-4 text-left transition",
          selected ? "bg-secondary/5" : "hover:bg-muted/40",
          wrongFiscal && "opacity-60",
        )}
      >
        <span
          className={cn(
            "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition",
            selected
              ? "border-secondary bg-secondary"
              : "border-muted-foreground/40",
          )}
        >
          {selected && (
            <span className="bg-background h-1.5 w-1.5 rounded-full" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="font-display text-base font-semibold tracking-tight">
              {plan.label}
            </p>
            <p className="font-display text-foreground text-sm font-semibold tabular-nums">
              {plan.priceLabel}
            </p>
            {currentlyActive && (
              <span className="bg-secondary/15 text-secondary rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                Active
              </span>
            )}
            {wrongFiscal && !currentlyActive && (
              <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
                Wrong fiscal
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-[12px] leading-snug">
            {plan.blurb}
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
          <Pill icon={MechanicIcon}>{plan.mechanic}</Pill>
          <Pill icon={Sparkles}>{plan.visibility}</Pill>
        </div>
      </button>
    </li>
  );
}

// ─── Fiscal toggle + payment-rail caption ────────────────────────────────

function FiscalSegmentedToggle({
  current,
  pending,
  onSwitch,
}: {
  current: "formal" | "informal";
  pending: boolean;
  onSwitch: (next: "formal" | "informal") => void;
}) {
  return (
    <div className="bg-muted inline-flex items-center rounded-full p-0.5">
      <FiscalSegment
        label="Formal"
        active={current === "formal"}
        pending={pending}
        onClick={() => onSwitch("formal")}
        tone="bg-pink-gradient text-white"
      />
      <FiscalSegment
        label="Informal"
        active={current === "informal"}
        pending={pending}
        onClick={() => onSwitch("informal")}
        tone="bg-tier-gold text-black"
      />
    </div>
  );
}

function FiscalSegment({
  label,
  active,
  pending,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  pending: boolean;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active || pending}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-semibold tracking-wider uppercase transition disabled:cursor-default",
        active ? tone : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && pending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : active ? (
        <Check className="h-3 w-3" />
      ) : null}
      {label}
    </button>
  );
}

function PaymentRailLine({ isFormal }: { isFormal: boolean }) {
  return (
    <p className="text-muted-foreground flex items-start gap-2 text-[12px] leading-relaxed">
      {isFormal ? (
        <CreditCard className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      ) : (
        <Percent className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      )}
      <span>
        <span className="text-foreground font-semibold">Payment rail:</span>{" "}
        {isFormal
          ? "Cashback only counts when the guest pays by card through Mesita. Cash at the table = no cashback."
          : "Discount is applied directly to the bill — cash or card. Mesita stays out of the payment flow."}
      </span>
    </p>
  );
}

function FreePlanBanner({ fiscalType }: { fiscalType: "formal" | "informal" }) {
  // Thin "won't go live until upgrade" banner shown above the segmentation
  // configurator. The UI underneath stays fully interactive so the manager
  // can set their rates before subscribing — it just won't be active for
  // guests yet.
  const mechanic = fiscalType === "formal" ? "cashback" : "discount";
  return (
    <section className="border-border bg-muted/30 flex items-start gap-3 rounded-2xl border border-dashed p-4">
      <AlertTriangle className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-muted-foreground text-[12px] leading-relaxed">
        You&apos;re on{" "}
        <span className="text-foreground font-semibold">Free</span>. Set your
        rates below — they won&apos;t go live for guests until you upgrade to a{" "}
        {mechanic}-enabled plan above.
      </p>
    </section>
  );
}

// ─── Segmentation ─────────────────────────────────────────────────────────

function SegmentationGroup({
  kind,
  title,
  blurb,
  children,
}: {
  kind: "basic" | "advanced";
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          {kind === "advanced" && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
              Coming soon
            </span>
          )}
        </div>
        <p className="text-muted-foreground max-w-xl text-[12px] leading-relaxed">
          {blurb}
        </p>
      </header>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

function FirstTimeSection({
  mechanicLabel,
}: {
  mechanicLabel: "Cashback" | "Discount";
}) {
  const [rate, setRate] = useState<RateChoice>(20);
  return (
    <section className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[11px] font-bold tracking-[0.18em] uppercase">
        First-time visitors
      </p>
      <div className="bg-primary/5 ring-primary/15 rounded-2xl p-5 ring-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="bg-welcome-gradient inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm">
              Welcome
            </span>
            <p className="text-foreground mt-2 text-sm">
              One-time {mechanicLabel.toLowerCase()} to convert a new guest into
              a regular.
            </p>
          </div>
          <span className="text-muted-foreground text-[11px]">
            First visit only
          </span>
        </div>

        <RatePicker label={mechanicLabel} rate={rate} onChange={setRate} />

        <AudienceStat
          count={12_480}
          countLabel="Guests nearby · never visited"
          sub="Identity revealed after first visit."
        />
      </div>
    </section>
  );
}

function ReturningTierGrid({
  mechanicLabel,
}: {
  mechanicLabel: "Cashback" | "Discount";
}) {
  return (
    <section className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[11px] font-bold tracking-[0.18em] uppercase">
        Returning visitors · by tier
      </p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {TIERS.map((t) => (
          <TierCard key={t.id} tier={t} mechanicLabel={mechanicLabel} />
        ))}
      </div>
    </section>
  );
}

function TierCard({
  tier,
  mechanicLabel,
}: {
  tier: TierMeta;
  mechanicLabel: "Cashback" | "Discount";
}) {
  // Diamond's default (30) isn't in the 4-rate scale, so snap to the next
  // scale value when seeding state.
  const initial: RateChoice = (RATE_CHOICES.find(
    (r) => r >= tier.defaultRate,
  ) ?? 50) as RateChoice;
  const [rate, setRate] = useState<RateChoice>(initial);

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <TierChip tier={tier.id} label={tier.label} />
        <span className="text-muted-foreground text-[11px]">
          {tier.visitRange}
        </span>
      </div>

      <RatePicker label={mechanicLabel} rate={rate} onChange={setRate} />

      <p className="text-muted-foreground text-[11px]">
        Est.{" "}
        <span className="text-secondary font-semibold">
          +{tier.estPerWeek} visits/wk
        </span>
      </p>

      <AudienceStat
        count={tier.onMesita}
        countLabel="On Mesita"
        sub={tier.source}
        handles={tier.handles}
        overflowHandles={tier.overflowHandles}
        publicPool={tier.publicPool}
      />
    </div>
  );
}

function RatePicker({
  label,
  rate,
  onChange,
}: {
  label: "Cashback" | "Discount";
  rate: RateChoice;
  onChange: (next: RateChoice) => void;
}) {
  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="font-display text-primary text-5xl leading-none font-bold tracking-tight">
          {rate}
        </span>
        <span className="font-display text-primary text-xl font-semibold">
          %
        </span>
        <span className="text-muted-foreground ml-1 text-[11px] font-bold tracking-[0.16em] uppercase">
          {label}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {RATE_CHOICES.map((c) => {
          const on = c === rate;
          return (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
                on
                  ? "bg-pink-gradient text-white shadow-sm"
                  : "border-border bg-background text-foreground hover:border-foreground/30 border",
              )}
            >
              {c}%
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AudienceStat({
  count,
  countLabel,
  sub,
  handles,
  overflowHandles,
  publicPool,
}: {
  count: number;
  countLabel: string;
  sub: string;
  handles?: string[];
  overflowHandles?: number;
  publicPool?: boolean;
}) {
  return (
    <div className="border-border bg-background rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-display text-lg font-bold tabular-nums">
          {count.toLocaleString()}
        </p>
        <p className="text-muted-foreground max-w-[55%] text-right text-[10px] font-bold tracking-[0.16em] uppercase">
          {countLabel}
        </p>
      </div>
      <p className="text-primary mt-0.5 text-[10px] font-bold tracking-[0.16em] uppercase">
        {sub}
      </p>
      {publicPool && (
        <p className="text-muted-foreground mt-1 text-[10px]">
          No social profile shared
        </p>
      )}
      {handles && handles.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {handles.map((h) => (
            <span
              key={h}
              className="bg-muted text-foreground inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
            >
              <Instagram className="text-muted-foreground h-2.5 w-2.5" />
              {h}
            </span>
          ))}
          {overflowHandles != null && overflowHandles > 0 && (
            <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
              +{overflowHandles}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function TierChip({ tier, label }: { tier: TierId; label: string }) {
  const tone = (() => {
    switch (tier) {
      case "bronze":
        return "bg-tier-bronze text-white";
      case "silver":
        return "bg-tier-silver text-foreground";
      case "gold":
        return "bg-tier-gold text-black";
      case "diamond":
        return "bg-tier-diamond text-white";
    }
  })();
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm",
        tone,
      )}
    >
      {label}
    </span>
  );
}

function Pill({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
      <Icon className="h-2.5 w-2.5" />
      {children}
    </span>
  );
}

// ─── Advanced segmentation (coming soon) ──────────────────────────────────

type AdvancedAxisMeta = {
  id: string;
  label: string;
  blurb: string;
  examples: string[];
  Icon: typeof Users;
};

const ADVANCED_AXES: AdvancedAxisMeta[] = [
  {
    id: "community",
    label: "Communities",
    blurb: "Email-verified schools and orgs — Tec, UDEM, Stanford, ITAM…",
    examples: ["Tec students only", "Stanford alumni", "ITAM Sundays"],
    Icon: GraduationCap,
  },
  {
    id: "demo",
    label: "Sex & age",
    blurb: "Boost or filter by demographic bands.",
    examples: ["Women 21–28", "Men 30+", "Any sex 25–35"],
    Icon: Users,
  },
  {
    id: "geo",
    label: "Country & city",
    blurb: "Reach visitors from specific places only.",
    examples: ["Visitors from CDMX", "Tourists from US / EU", "Locals only"],
    Icon: MapPin,
  },
  {
    id: "occasion",
    label: "Date & occasion",
    blurb: "Time-window boosts for slow nights or events.",
    examples: ["Mondays only", "Birthday week", "Pride · Día de la Madre"],
    Icon: Calendar,
  },
  {
    id: "custom",
    label: "Custom rules",
    blurb: "Compose AND / OR filters across every axis.",
    examples: ["Gold + Tec + Female", "Silver + birthday + Monday"],
    Icon: Filter,
  },
];

function AdvancedSegmentationGrid() {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
      {ADVANCED_AXES.map((a) => (
        <AdvancedAxisCard key={a.id} axis={a} />
      ))}
    </div>
  );
}

function AdvancedAxisCard({ axis }: { axis: AdvancedAxisMeta }) {
  const Icon = axis.Icon;
  return (
    <div className="border-border bg-card flex flex-col gap-2 rounded-2xl border p-4 opacity-80 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold tracking-wider uppercase">
          <Icon className="h-3 w-3" />
          {axis.label}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          Soon
        </span>
      </div>
      <p className="text-muted-foreground text-[12px] leading-relaxed">
        {axis.blurb}
      </p>
      <ul className="mt-1 flex flex-col gap-1">
        {axis.examples.map((ex) => (
          <li
            key={ex}
            className="bg-muted/40 text-muted-foreground rounded-md px-2 py-1 text-[11px]"
          >
            {ex}
          </li>
        ))}
      </ul>
    </div>
  );
}
