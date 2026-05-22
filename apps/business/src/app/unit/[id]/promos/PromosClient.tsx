"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
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

// Promos. Four sections, top to bottom:
//   1. Mesita Visibility       — meter + upgrade pitch
//   2. Plan & Reward Mechanic  — pick Free/Pro + pick Cashback/Discount
//   3. Basic Promos            — Welcome offer + per-tier rates
//   4. Advanced Promos         — extra segmentation axes (coming soon)
//
// The rate-picker label reads "OFF" everywhere — it's the neutral word
// for both mechanics (a 20% reward off the bill, however it lands), so
// the same numeric scale works whether the venue runs cashback or
// discount.

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

  const isFree = venue.plan === "free";
  const currentDisplayPlan: DisplayPlanId = displayPlanForVenue(venue.plan);

  const [pendingPlanId, setPendingPlanId] = useState<DisplayPlanId | null>(
    null,
  );

  const selectPlan = (target: DisplayPlanId) => {
    if (target === currentDisplayPlan || pending) return;
    const dbPlan = dbPlanForSelection(target, venue.fiscal_type);
    if (dbPlan === venue.plan) return;
    setError(null);
    setSaved(false);
    setPendingPlanId(target);
    startSubmit(async () => {
      try {
        await apiUpdateVenue(supabase, { id: venue.id, plan: dbPlan });
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(errMsg(err, "Couldn't save the plan."));
      } finally {
        setPendingPlanId(null);
      }
    });
  };

  // Persisted Promos section toggles. Optimistic write — local state
  // flips immediately, then `apiUpdateVenue` persists in the background.
  // On failure the toggle rolls back and the error banner surfaces it.
  const [basicEnabled, setBasicEnabled] = useState(
    venue.segmentation_basic_enabled,
  );
  const [advancedEnabled, setAdvancedEnabled] = useState(
    venue.segmentation_advanced_enabled,
  );
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
    writeToggle("segmentation_basic_enabled", next, () =>
      setBasicEnabled(!next),
    );
  };
  const handleAdvancedToggle = (next: boolean) => {
    setAdvancedEnabled(next);
    writeToggle("segmentation_advanced_enabled", next, () =>
      setAdvancedEnabled(!next),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Mesita Visibility */}
      <VisibilityMeter plan={venue.plan} />

      {/* 2. Plan */}
      <Section
        title="Plan"
        subtitle="Free auto-lists you and accepts AI reservations. Pro adds priority discovery, customer-acquisition tools, and the dashboard."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PLANS.map((p) => {
            const isCurrent = p.id === currentDisplayPlan;
            const isPending = pendingPlanId === p.id;
            const buttonLabel = isCurrent
              ? "Current"
              : p.id === "free"
                ? "Switch to Free"
                : "Become Pro";
            return (
              <Card
                key={p.id}
                className={cn(
                  "relative rounded-2xl",
                  p.featured && "border-foreground shadow-elev",
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
                <CardHeader className="gap-1.5">
                  <CardTitle className="font-display text-xl font-semibold tracking-tight">
                    {p.label}
                  </CardTitle>
                  <p className="font-display text-2xl font-bold tabular-nums leading-none">
                    {p.price}
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      {p.cadence}
                    </span>
                  </p>
                  <CardDescription className="text-[12px] leading-relaxed">
                    {p.blurb}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <ul className="flex flex-col gap-1 text-[12px]">
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
                    size="sm"
                    variant={p.featured ? "default" : "outline"}
                    onClick={() => selectPlan(p.id)}
                    disabled={isCurrent || pending}
                    className={cn(
                      "rounded-full",
                      p.featured &&
                        !isCurrent &&
                        "bg-pink-gradient shadow-glow text-white hover:opacity-90",
                    )}
                  >
                    {isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : null}
                    {buttonLabel}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {(error || saved) && (
          <p
            className={cn(
              "rounded-lg px-3 py-2 text-xs",
              error
                ? "bg-destructive/10 text-destructive"
                : "bg-secondary/10 text-secondary",
            )}
          >
            {error ?? "Saved."}
          </p>
        )}

        {isFree && <FreePlanNotice fiscalType={venue.fiscal_type} />}
      </Section>

      {/* 3. Reward Mechanic */}
      <Section
        title="Reward Mechanic"
        subtitle="How guests get the reward. Pick the one that matches how your business already settles payments."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

      {/* 3. Basic Promos */}
      <Section
        title="Basic Promos"
        subtitle="The two levers every Pro venue gets: a Welcome offer for first-time guests, and per-tier rates for returning ones across Bronze, Silver, Gold, and Diamond."
        enabled={basicEnabled}
        onEnabledChange={handleBasicToggle}
      >
        <WelcomeCard />
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
            Returning visitors · by tier
          </p>
          <div className="flex flex-col gap-2">
            {TIERS.map((t) => (
              <TierRow key={t.id} tier={t} />
            ))}
          </div>
        </div>
      </Section>

      {/* 4. Advanced Promos */}
      <Section
        title="Advanced Promos"
        subtitle="Stack extra dimensions on top of the tier rates — communities, demographics, geography, custom filters. Coming soon; off by default."
        enabled={advancedEnabled}
        onEnabledChange={handleAdvancedToggle}
      >
        <AdvancedComingSoon />
      </Section>
    </div>
  );
}

// ─── Mesita Visibility meter ──────────────────────────────────────────────

function VisibilityMeter({ plan }: { plan: VenuePlan }) {
  const current = visibilityForPlan(plan);
  // The ladder is purely "more visibility" — every step up shows you
  // to more guests on Mesita. No per-step feature claims; none of the
  // ranking-engine work that would justify them is shipped yet.
  const levels: {
    label: string;
    planLabel: string;
    realLabel?: PlanVisibility;
    soon?: boolean;
  }[] = [
    { label: "Minimum", planLabel: "Free", realLabel: "Minimum" },
    { label: "Priority", planLabel: "Pro · Discount", realLabel: "Priority" },
    { label: "Maximum", planLabel: "Pro · Cashback", realLabel: "Maximum" },
    { label: "Featured", planLabel: "Add-on", soon: true },
    { label: "Spotlight", planLabel: "Add-on", soon: true },
  ];
  const currentIdx = levels.findIndex((l) => l.realLabel === current);
  const atTopReal = current === "Maximum";
  const totalReal = levels.filter((l) => !l.soon).length;

  return (
    <Section
      title="Mesita Visibility"
      subtitle="The product you're buying here — how many guests see you across swipe, catalog, map, and the AI planner."
    >
      {/* Stepper — 5 numbered circles. The first three are real plan
          tiers; the last two render as "Soon" with no fill. The
          current step carries the pink-gradient + glow ring. */}
      <div className="flex items-start overflow-x-auto pb-1">
        {levels.map((l, i) => {
          const reached = !l.soon && i <= currentIdx;
          const isCurrent = i === currentIdx;
          const isLast = i === levels.length - 1;
          const nextReached = i < currentIdx;
          return (
            <div
              key={l.label}
              className="flex min-w-[110px] flex-1 flex-col items-center"
            >
              <div className="flex w-full items-center">
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    i === 0
                      ? "bg-transparent"
                      : i <= currentIdx
                        ? "bg-pink-gradient"
                        : "bg-muted",
                  )}
                />
                <div
                  className={cn(
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                    reached
                      ? "bg-pink-gradient text-white"
                      : l.soon
                        ? "border-border border border-dashed bg-transparent text-muted-foreground/70"
                        : "bg-muted text-muted-foreground border-border border",
                    isCurrent &&
                      "shadow-glow ring-foreground/30 ring-2 ring-offset-2",
                  )}
                >
                  {i + 1}
                  {isCurrent && (
                    <span className="text-primary absolute -bottom-5 text-[9px] font-bold tracking-wider uppercase">
                      You
                    </span>
                  )}
                </div>
                <div
                  className={cn(
                    "h-0.5 flex-1",
                    isLast
                      ? "bg-transparent"
                      : nextReached
                        ? "bg-pink-gradient"
                        : "bg-muted",
                  )}
                />
              </div>
              <div className="mt-4 flex flex-col items-center text-center">
                <span
                  className={cn(
                    "text-[11px] font-bold tracking-[0.12em] uppercase",
                    reached
                      ? "text-foreground"
                      : l.soon
                        ? "text-muted-foreground/70"
                        : "text-muted-foreground",
                  )}
                >
                  {l.label}
                </span>
                {l.soon ? (
                  <span className="bg-muted text-muted-foreground mt-0.5 inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase">
                    Soon
                  </span>
                ) : (
                  <span
                    className={cn(
                      "text-[9px] font-medium tracking-wider uppercase",
                      isCurrent ? "text-primary" : "text-muted-foreground/70",
                    )}
                  >
                    {l.planLabel}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground border-border bg-muted/30 rounded-xl border px-3 py-2.5 text-[12px] leading-relaxed">
        {atTopReal ? (
          <>
            You&apos;re at the top tier we&apos;ve shipped (
            <span className="text-foreground font-semibold">Maximum</span>).
            Two more tiers are on the roadmap.
          </>
        ) : (
          <>
            You&apos;re at step{" "}
            <span className="text-foreground font-semibold">
              {currentIdx + 1}
            </span>{" "}
            of{" "}
            <span className="text-foreground font-semibold">{totalReal}</span>.
            Each step up means more guests see you on Mesita.
          </>
        )}
      </p>
    </Section>
  );
}

// ─── Plan & Mechanic helpers ──────────────────────────────────────────────

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
          tagline:
            "The guest pays with card, Mesita returns part of the bill to their wallet.",
          bullets: [
            "Ideal for businesses that issue invoices",
            "Card payment runs through Mesita",
            "Cashback lands in the guest's wallet, redeemable at any partner",
          ],
          Icon: CreditCard,
          accent: "bg-pink-gradient text-white",
        }
      : {
          label: "Discount",
          tagline:
            "The guest shows you the coupon, you apply the discount. Mesita is not in the payment flow.",
          bullets: [
            "Ideal for businesses that don't issue invoices",
            "Discount applied directly at the bill — cash or card, your call",
            "Mesita doesn't touch the transaction",
          ],
          Icon: Percent,
          accent: "bg-tier-gold text-black",
        };
  return (
    <Card
      className={cn(
        "relative rounded-2xl",
        isCurrent && "border-foreground shadow-elev",
      )}
    >
      {isCurrent && (
        <Badge className="bg-secondary text-secondary-foreground absolute -top-2.5 right-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
          Selected
        </Badge>
      )}
      <CardHeader className="gap-1.5">
        <CardTitle className="font-display flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-full",
              meta.accent,
            )}
          >
            <meta.Icon className="h-3.5 w-3.5" />
          </span>
          {meta.label}
        </CardTitle>
        <CardDescription className="text-[12px] leading-relaxed">
          {meta.tagline}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1 text-[12px]">
          {meta.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 leading-snug">
              <CheckCircle2 className="text-secondary mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          size="sm"
          variant={isCurrent ? "default" : "outline"}
          onClick={onPick}
          disabled={isCurrent || pending}
          className={cn(
            "rounded-full",
            isCurrent &&
              "bg-foreground text-background hover:bg-foreground/90",
          )}
        >
          {pending && !isCurrent ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : null}
          {isCurrent ? "Selected" : `Switch to ${meta.label}`}
        </Button>
      </CardContent>
    </Card>
  );
}

function FreePlanNotice({ fiscalType }: { fiscalType: "formal" | "informal" }) {
  const mechanic = fiscalType === "formal" ? "cashback" : "discount";
  return (
    <div className="bg-muted/40 text-muted-foreground flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        You&apos;re on{" "}
        <span className="text-foreground font-semibold">Free</span>. Set your
        Basic Promos below — they won&apos;t go live for guests until you
        upgrade to a {mechanic}-enabled Pro plan above.
      </p>
    </div>
  );
}

// ─── Basic Promos: Welcome + tier rows ────────────────────────────────────

function WelcomeCard() {
  const [rate, setRate] = useState<RateChoice>(20);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground text-[10px] font-bold tracking-[0.14em] uppercase">
        First-time visitors
      </p>
      <div className="bg-primary/5 ring-primary/15 flex flex-col gap-4 rounded-2xl p-4 ring-1 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="bg-welcome-gradient inline-flex rounded-full px-3 py-1 text-[10px] font-bold tracking-wider text-white uppercase shadow-sm">
              Welcome
            </span>
            <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
              First visit only
            </span>
          </div>
          <p className="text-foreground mt-2 text-sm">
            One-time offer to convert a new guest into a regular.
          </p>
        </div>
        <div className="lg:w-72">
          <RatePicker rate={rate} onChange={setRate} />
        </div>
        <AudienceMini
          count={12_480}
          countLabel="Nearby · never visited"
          sub="Identity revealed after first visit."
        />
      </div>
    </div>
  );
}

function TierRow({ tier }: { tier: TierMeta }) {
  // Diamond's default (30) isn't in the 4-rate scale — snap to next valid.
  const initial: RateChoice = (RATE_CHOICES.find(
    (r) => r >= tier.defaultRate,
  ) ?? 50) as RateChoice;
  const [rate, setRate] = useState<RateChoice>(initial);
  return (
    <div className="border-border bg-card grid grid-cols-1 gap-3 rounded-2xl border p-3 lg:grid-cols-[160px_minmax(0,1fr)_220px] lg:items-center lg:gap-4">
      {/* Tier + visit range */}
      <div className="flex items-center justify-between gap-3 lg:flex-col lg:items-start lg:gap-1">
        <TierChip tier={tier.id} label={tier.label} />
        <span className="text-muted-foreground text-[11px]">
          {tier.visitRange}
        </span>
      </div>

      {/* Rate picker + estimate */}
      <div className="flex flex-col gap-1.5">
        <RatePicker rate={rate} onChange={setRate} />
        <p className="text-muted-foreground text-[10px]">
          Est.{" "}
          <span className="text-secondary font-semibold">
            +{tier.estPerWeek} visits/wk
          </span>
        </p>
      </div>

      {/* Audience */}
      <AudienceMini
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
  rate,
  onChange,
}: {
  rate: RateChoice;
  onChange: (next: RateChoice) => void;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <p className="flex items-baseline gap-0.5">
        <span className="font-display text-primary text-3xl leading-none font-bold tracking-tight tabular-nums">
          {rate}
        </span>
        <span className="font-display text-primary text-lg font-semibold">
          %
        </span>
        <span className="text-muted-foreground ml-1.5 text-[10px] font-bold tracking-[0.14em] uppercase">
          off
        </span>
      </p>
      <div className="flex flex-wrap gap-1">
        {RATE_CHOICES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold transition",
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

function AudienceMini({
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
    <div className="border-border bg-background flex flex-col gap-1 rounded-xl border p-2.5">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-base font-bold tabular-nums leading-none">
          {count.toLocaleString()}
        </p>
        <p className="text-muted-foreground text-[9px] font-medium tracking-[0.14em] uppercase">
          {countLabel}
        </p>
      </div>
      <p className="text-primary text-[9px] font-medium tracking-[0.14em] uppercase">
        {sub}
      </p>
      {publicPool && (
        <p className="text-muted-foreground text-[9px]">
          No social profile shared
        </p>
      )}
      {handles && handles.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1">
          {handles.map((h) => (
            <span
              key={h}
              className="bg-muted text-foreground inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
            >
              <Instagram className="text-muted-foreground h-2.5 w-2.5" />
              {h}
            </span>
          ))}
          {overflowHandles != null && overflowHandles > 0 && (
            <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold">
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

// ─── Advanced Promos (coming soon) ────────────────────────────────────────

// Quiet placeholder while Advanced Promos is still in the oven. Lists
// the planned axes inline so a manager who flips the toggle on still
// learns what's coming, without the heavy 5-card preview grid.
const ADVANCED_AXES: { label: string; Icon: typeof Users }[] = [
  { label: "Communities", Icon: GraduationCap },
  { label: "Sex & age", Icon: Users },
  { label: "Country & city", Icon: MapPin },
  { label: "Date & occasion", Icon: Calendar },
  { label: "Custom rules", Icon: Filter },
];

function AdvancedComingSoon() {
  return (
    <div className="border-border bg-muted/30 flex flex-col items-center gap-3 rounded-2xl border border-dashed p-8 text-center">
      <span className="bg-pink-gradient shadow-glow inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-white uppercase">
        <Sparkles className="h-3 w-3" />
        Coming soon
      </span>
      <p className="text-muted-foreground max-w-md text-[12px] leading-relaxed">
        Stack extra dimensions on top of the tier rates — communities,
        demographics, geography, date windows, custom AND / OR filters.
        Landing with the segments table.
      </p>
      <div className="flex flex-wrap justify-center gap-1.5">
        {ADVANCED_AXES.map((a) => (
          <span
            key={a.label}
            className="bg-card border-border text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium"
          >
            <a.Icon className="h-3 w-3" />
            {a.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Section card + toggle switch ─────────────────────────────────────────

function Section({
  title,
  subtitle,
  enabled,
  onEnabledChange,
  children,
}: {
  title: string;
  subtitle?: string;
  enabled?: boolean;
  onEnabledChange?: (next: boolean) => void;
  children: React.ReactNode;
}) {
  const hasToggle = onEnabledChange !== undefined;
  const showChildren = !hasToggle || enabled !== false;
  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
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
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
        checked ? "bg-pink-gradient shadow-glow" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition",
          checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </button>
  );
}
