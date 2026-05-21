"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  Filter,
  GraduationCap,
  Instagram,
  Loader2,
  MapPin,
  Percent,
  Users,
} from "lucide-react";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdateVenue, type MyVenue, type VenuePlan } from "@/lib/api/venues";
import type { Tier } from "@/lib/guest-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TicketTypesCard } from "@/components/manager/TicketTypesCard";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
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

type TierMeta = {
  id: Tier;
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
  const supabase = useBrowserSupabase();

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
        setFiscalError(errMsg(err, "Couldn't save."));
      }
    });
  };

  const isFormal = venue.fiscal_type === "formal";
  const mechanic = mechanicForPlan(plan);
  const savedMechanic = mechanicForPlan(venue.plan);

  const [pendingPlanId, setPendingPlanId] = useState<VenuePlan | null>(null);

  const selectPlan = (target: VenuePlan) => {
    if (target === venue.plan || pending) return;
    setError(null);
    setSaved(false);
    setPlan(target);
    setPendingPlanId(target);
    startSubmit(async () => {
      try {
        await apiUpdateVenue(supabase, { id: venue.id, plan: target });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save the plan."));
      } finally {
        setPendingPlanId(null);
      }
    });
  };

  const mechanicLabel = savedMechanic === "Discount" ? "Discount" : "Cashback";

  return (
    <div className="flex flex-col gap-6">
      {/* ── Plan ─────────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-6">
        <header className="flex flex-col items-start gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium tracking-[0.18em] uppercase">
              Pricing
            </p>
            <h2 className="font-display mt-2 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
              Three plans. Per venue. Cancel anytime.
            </h2>
          </div>
          <p className="text-muted-foreground max-w-sm text-sm">
            The coupon mechanic is pinned by your fiscal type — Formal partners
            run cashback, Informal partners run instant discount. Switch fiscal
            type and the plan list re-narrows.
          </p>
        </header>

        <FiscalSegmentedToggle
          current={venue.fiscal_type}
          pending={fiscalPending}
          onSwitch={switchFiscal}
        />

        {fiscalError && <p className={ERROR_BOX_CLASS}>{fiscalError}</p>}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((p) => {
            const isCurrent = p.id === venue.plan;
            const scope = p.fiscalScope;
            const wrongFiscal =
              scope !== "any" &&
              ((isFormal && scope === "informal") ||
                (!isFormal && scope === "formal"));
            const isPending = pendingPlanId === p.id;
            const buttonLabel = isCurrent
              ? "Current plan"
              : wrongFiscal
                ? "Switch fiscal first"
                : p.id === "free"
                  ? "Use Free"
                  : `Become ${p.label}`;
            return (
              <Card
                key={p.id}
                className={cn(
                  "relative gap-3 rounded-2xl",
                  p.featured && "border-foreground shadow-elev",
                  wrongFiscal && !isCurrent && "opacity-60",
                )}
              >
                {isCurrent && (
                  <Badge className="bg-secondary text-secondary-foreground absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                    Current
                  </Badge>
                )}
                {!isCurrent && p.featured && (
                  <Badge className="bg-pink-gradient shadow-glow absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                    Featured
                  </Badge>
                )}
                <CardHeader>
                  <CardTitle className="font-display text-2xl font-semibold tracking-tight">
                    {p.label}
                  </CardTitle>
                  <p className="font-display text-4xl font-bold tabular-nums">
                    {p.price}
                    <span className="text-muted-foreground ml-1 text-sm font-normal">
                      {p.cadence}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="rounded-full">
                      {p.mechanic}
                    </Badge>
                    <Badge variant="secondary" className="rounded-full">
                      {p.visibility} visibility
                    </Badge>
                  </div>
                  <CardDescription className="text-[13px] leading-relaxed">
                    {p.blurb}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <ul className="flex flex-1 flex-col gap-1.5 text-[12px]">
                    {p.bullets.map((b) => (
                      <li
                        key={b}
                        className="flex items-start gap-2 leading-snug"
                      >
                        <CheckCircle2 className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    size="lg"
                    variant={p.featured ? "default" : "outline"}
                    onClick={() => selectPlan(p.id)}
                    disabled={isCurrent || wrongFiscal || pending}
                    className={cn(
                      "rounded-full",
                      p.featured &&
                        !isCurrent &&
                        "bg-pink-gradient shadow-glow text-white hover:opacity-90",
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {buttonLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <PaymentRailLine isFormal={isFormal} />

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

        <div className="text-muted-foreground grid grid-cols-1 gap-3 text-[13px] leading-relaxed md:grid-cols-3">
          <p>
            <span className="text-foreground font-semibold">
              Per-venue billing.
            </span>{" "}
            Multi-unit operators pick a plan per location — different plans per
            venue are fine. Manager accounts are always free.
          </p>
          <p>
            <span className="text-foreground font-semibold">
              Why Informal is 2× Formal.
            </span>{" "}
            Formal partners feed the Mesita wallet — transaction data and a
            redemption network on the back-end. Informal pays more for the same
            priority placement.
          </p>
          <p>
            <span className="text-foreground font-semibold">
              Payment rail rule.
            </span>{" "}
            Cashback only counts when the guest pays by card through Mesita. At
            Informal venues the discount applies at the bill — cash or card,
            either works.
          </p>
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
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
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
      <p className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
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
        <span className="text-muted-foreground ml-1 text-[11px] font-medium tracking-[0.14em] uppercase">
          {label}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {RATE_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold transition",
              c === rate
                ? "bg-pink-gradient text-white shadow-sm"
                : "border-border bg-background text-foreground hover:border-foreground/30 border",
            )}
          >
            {c}%
          </button>
        ))}
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
        <p className="text-muted-foreground max-w-[55%] text-right text-[10px] font-medium tracking-[0.14em] uppercase">
          {countLabel}
        </p>
      </div>
      <p className="text-primary mt-0.5 text-[10px] font-medium tracking-[0.14em] uppercase">
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
        "inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase shadow-sm",
        TIER_TONE[tier],
      )}
    >
      {label}
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
