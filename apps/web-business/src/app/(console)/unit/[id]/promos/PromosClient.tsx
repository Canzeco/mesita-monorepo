"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Loader2,
  Lock,
  MessageCircle,
  Percent,
  ShieldCheck,
  Ticket,
  type LucideIcon,
} from "lucide-react";
import { Section } from "@/components/shared";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { apiUpdatePlace, type MyPlace } from "@/lib/api/places";
import { cn, errMsg } from "@/lib/utils";
import { ERROR_BOX_CLASS } from "@/lib/ui-classes";
import {
  STRATEGIES,
  STRATEGY_BY_ID,
  STRATEGY_VISIBILITY_LADDER,
  UNIVERSAL_CAP_MXN,
  strategyForPlace,
  type Strategy,
  type StrategyId,
  type StrategyVisibility,
} from "@/lib/business/strategies";

// Promos — Buzz v4. Two boxes, top to bottom:
//   1. Strategy   — pick ONE of four presets (Zero → Dominant). Each writes the
//                   four per-tier rate columns + the universal cap in one save.
//   2. Membership — the MX$1,000/year Verified signing fee that unlocks the paid
//                   strategies + the promo lane, with the strikes rules.
//
// The old model (Free/Pro/Ultra monthly subscriptions, four independent rate
// pickers, Instagram + Guests subtabs) is retired: important venues now rank
// free in the organic lane, so rank is never for sale and there's nothing to
// tune cell-by-cell — you choose a posture, not sixteen knobs.

// One-time yearly signing fee. Presented here; the annual-billing flow itself
// is a human-gated follow-up (live money), so this box is status + model, not a
// self-serve charge.
const MEMBERSHIP_FEE_MXN = 1000;

// "MX$1,000" for MXN places; falls back to a generic "$" prefix elsewhere.
function formatMoney(amount: number, currency: string): string {
  const prefix = currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

// Membership status is derived from the existing plan column: a place still on
// `free` is not Verified (Zero only); any paid plan is treated as a member.
// The self-serve annual-membership billing rewire is a separate, human-gated
// change — this page reads status, it doesn't move money.
function isVerifiedMember(place: MyPlace): boolean {
  return place.plan !== "free";
}

// ─── Client ───────────────────────────────────────────────────────────────

export function PromosClient({ place }: { place: MyPlace }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const isMember = isVerifiedMember(place);

  // The strategy the stored rates currently reflect (null = custom/legacy).
  const storedStrategy = strategyForPlace(place);
  const [selectedId, setSelectedId] = useState<StrategyId | null>(storedStrategy);
  const [pendingId, setPendingId] = useState<StrategyId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Selecting a strategy writes all four rate columns + the cap atomically.
  // Optimistic: the card lights up immediately and reverts on failure.
  const applyStrategy = (target: StrategyId) => {
    if (pendingId) return;
    if (target === selectedId) return;
    // Paid strategies require Verified membership; Zero is always available.
    if (target !== "zero" && !isMember) return;

    const strat = STRATEGY_BY_ID[target];
    const previous = selectedId;
    setSelectedId(target);
    setPendingId(target);
    setError(null);
    void apiUpdatePlace(supabase, {
      id: place.id,
      welcome_free_rate: strat.rates.welcome_free_rate,
      welcome_premium_rate: strat.rates.welcome_premium_rate,
      free_rate: strat.rates.free_rate,
      premium_rate: strat.rates.premium_rate,
      monthly_promo_cap: strat.cap,
    })
      .then(() => router.refresh())
      .catch((err) => {
        setSelectedId(previous);
        setError(errMsg(err, "Couldn't save the strategy."));
      })
      .finally(() => setPendingId(null));
  };

  // Numbers to preview in the matrix + rail: the selection, falling back to
  // Zero when the place carries custom legacy rates.
  const activeStrategy = STRATEGY_BY_ID[selectedId ?? "zero"];

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Promos
        </h2>
        <p className="text-muted-foreground text-[13px] leading-snug">
          Big discounts to win them, fair discounts to keep them — and Premium
          guests always get more.
        </p>
      </header>

      <StrategyBox
        selectedId={selectedId}
        pendingId={pendingId}
        isMember={isMember}
        isCustom={storedStrategy === null}
        currency={place.currency}
        activeStrategy={activeStrategy}
        error={error}
        onSelect={applyStrategy}
      />

      <MembershipBox isMember={isMember} currency={place.currency} />
    </div>
  );
}

// ─── Box 1 · Strategy ───────────────────────────────────────────────────────

function StrategyBox({
  selectedId,
  pendingId,
  isMember,
  isCustom,
  currency,
  activeStrategy,
  error,
  onSelect,
}: {
  selectedId: StrategyId | null;
  pendingId: StrategyId | null;
  isMember: boolean;
  isCustom: boolean;
  currency: string;
  activeStrategy: Strategy;
  error: string | null;
  onSelect: (id: StrategyId) => void;
}) {
  return (
    <Section
      title="Discount strategy"
      description="Pick one posture. A stronger discount reads as a stronger card and shows to more guests."
      className="bg-gradient-to-b from-white to-fuchsia-50/[0.25]"
    >
      <CapBanner currency={currency} />

      {!isMember && (
        <div className="border-border bg-muted/30 text-foreground/75 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          <span>
            Only <span className="font-semibold">Zero</span> is available until
            you activate Verified membership — see below.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {STRATEGIES.map((s) => (
          <StrategyCard
            key={s.id}
            strategy={s}
            selected={s.id === selectedId}
            pending={s.id === pendingId}
            locked={s.id !== "zero" && !isMember}
            onSelect={() => onSelect(s.id)}
          />
        ))}
      </div>

      {isCustom && (
        <p className="text-muted-foreground text-[11px]">
          Your current rates don&apos;t match a preset — pick a strategy to
          standardize them.
        </p>
      )}

      <SelectedMatrix strategy={activeStrategy} currency={currency} />
      <VisibilityRail visibility={activeStrategy.visibility} />

      {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
    </Section>
  );
}

// Universal cap — always displayed. The discount only ever applies to the
// first MX$500 of the bill, so a headline percentage stays a bounded cost.
function CapBanner({ currency }: { currency: string }) {
  return (
    <div className="border-border bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2">
      <Percent className="text-primary h-4 w-4 shrink-0" />
      <p className="text-foreground/80 text-[11px] leading-snug">
        Every discount applies to the first{" "}
        <span className="text-foreground font-semibold">
          {formatMoney(UNIVERSAL_CAP_MXN, currency)}
        </span>{" "}
        of the bill — a platform-wide cap, always shown to guests.
      </p>
    </div>
  );
}

function StrategyCard({
  strategy,
  selected,
  pending,
  locked,
  onSelect,
}: {
  strategy: Strategy;
  selected: boolean;
  pending: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  // Best-case headline = the Premium welcome rate (always the top cell).
  const top = strategy.rates.welcome_premium_rate;
  return (
    <button
      type="button"
      onClick={locked ? undefined : onSelect}
      disabled={pending || locked}
      aria-pressed={selected}
      className={cn(
        "relative flex flex-col gap-2 rounded-2xl border p-3.5 text-left transition",
        selected
          ? "border-foreground shadow-elev ring-foreground/10 bg-white ring-1"
          : "border-border bg-card",
        !selected &&
          !locked &&
          "hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-24px_rgba(236,72,153,0.5)]",
        locked && "cursor-not-allowed opacity-65",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5">
          <span className="text-lg leading-none">{strategy.emoji}</span>
          <span className="font-display text-sm font-semibold tracking-tight">
            {strategy.name}
          </span>
        </span>
        {selected ? (
          <span className="bg-foreground text-background inline-flex h-5 w-5 items-center justify-center rounded-full">
            <Check className="h-3 w-3" />
          </span>
        ) : locked ? (
          <Lock className="text-muted-foreground h-3.5 w-3.5" />
        ) : null}
      </div>

      <div className="flex items-baseline gap-1">
        {top == null ? (
          <span className="text-muted-foreground text-sm font-semibold">
            No promos
          </span>
        ) : (
          <>
            <span className="text-muted-foreground text-[11px]">up to</span>
            <span className="font-display text-primary text-2xl leading-none font-bold tabular-nums">
              {top}
              <span className="text-base">%</span>
            </span>
            <span className="text-muted-foreground text-[11px]">off</span>
          </>
        )}
      </div>

      <p className="text-muted-foreground text-[11px] leading-snug">
        {strategy.tagline}
      </p>

      <span className="bg-muted/70 text-foreground/70 mt-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide">
        {strategy.visibility} visibility
      </span>

      {pending && (
        <Loader2 className="text-muted-foreground absolute top-3 right-3 h-4 w-4 animate-spin" />
      )}
    </button>
  );
}

// The exact discount the selected strategy offers, as a Welcome/Returning ×
// Free/Premium grid. Premium column is tinted so "Premium always gets more"
// reads at a glance.
function SelectedMatrix({
  strategy,
  currency,
}: {
  strategy: Strategy;
  currency: string;
}) {
  if (strategy.id === "zero") {
    return (
      <div className="border-border bg-muted/20 rounded-xl border border-dashed px-3 py-3 text-center">
        <p className="text-muted-foreground text-[12px] leading-snug">
          No discounts on Zero — your place still appears in the catalog and the
          free organic lane.
        </p>
      </div>
    );
  }
  const r = strategy.rates;
  return (
    <div className="border-border overflow-hidden rounded-xl border bg-white">
      <div className="grid grid-cols-[1.1fr_1fr_1fr]">
        <MatrixHead>
          {strategy.emoji} {strategy.name}
        </MatrixHead>
        <MatrixHead center>Free</MatrixHead>
        <MatrixHead center premium>
          Premium
        </MatrixHead>

        <MatrixRowLabel>First visit</MatrixRowLabel>
        <MatrixValue value={r.welcome_free_rate} />
        <MatrixValue value={r.welcome_premium_rate} premium />

        <MatrixRowLabel last>Returning</MatrixRowLabel>
        <MatrixValue value={r.free_rate} last />
        <MatrixValue value={r.premium_rate} premium last />
      </div>
      <div className="border-border text-muted-foreground border-t px-3 py-1.5 text-[10px]">
        Off the first {formatMoney(UNIVERSAL_CAP_MXN, currency)} of the bill.
      </div>
    </div>
  );
}

function MatrixHead({
  children,
  center,
  premium,
}: {
  children: React.ReactNode;
  center?: boolean;
  premium?: boolean;
}) {
  return (
    <div
      className={cn(
        "border-border border-b px-3 py-2 text-[10px] font-bold tracking-wide uppercase",
        center && "text-center",
        premium
          ? "text-tier-premium bg-tier-premium/10"
          : "text-muted-foreground",
      )}
    >
      {children}
    </div>
  );
}

function MatrixRowLabel({
  children,
  last,
}: {
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "text-foreground/70 px-3 py-2.5 text-[11px] font-semibold",
        !last && "border-border border-b",
      )}
    >
      {children}
    </div>
  );
}

function MatrixValue({
  value,
  premium,
  last,
}: {
  value: number | null;
  premium?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center px-3 py-2.5 tabular-nums",
        !last && "border-border border-b",
        premium && "bg-tier-premium/[0.06]",
      )}
    >
      {value == null ? (
        <span className="text-muted-foreground text-sm">—</span>
      ) : (
        <span
          className={cn(
            "font-display text-lg leading-none font-bold",
            premium ? "text-tier-premium" : "text-foreground/80",
          )}
        >
          {value}
          <span className="text-[11px] font-semibold">%</span>
        </span>
      )}
    </div>
  );
}

// Where the selected strategy lands on the four-step visibility ladder.
function VisibilityRail({ visibility }: { visibility: StrategyVisibility }) {
  const currentIdx = STRATEGY_VISIBILITY_LADDER.indexOf(visibility);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-[10px] font-bold tracking-[0.18em] uppercase">
          Visibility
        </span>
        <span className="text-foreground text-[11px] font-semibold">
          {visibility}
        </span>
      </div>
      <div className="flex items-center">
        {STRATEGY_VISIBILITY_LADDER.map((level, i) => {
          const isCurrent = i === currentIdx;
          return (
            <Fragment key={level}>
              {i > 0 && (
                <div
                  className={cn(
                    "h-1.5 flex-1 rounded-full",
                    i <= currentIdx ? "bg-pink-gradient" : "bg-muted/80",
                  )}
                />
              )}
              <div
                className={cn(
                  "shrink-0 rounded-full transition",
                  isCurrent
                    ? "bg-pink-gradient shadow-glow h-4 w-4 ring-4 ring-pink-500/25"
                    : i < currentIdx
                      ? "bg-pink-gradient h-3 w-3"
                      : "bg-muted/80 h-3 w-3",
                )}
              />
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

// ─── Box 2 · Membership ─────────────────────────────────────────────────────

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "Warning, and we re-run the activation test." },
  { n: "2", consequence: "Your promo lane is paused for 30 days." },
  {
    n: "3",
    consequence:
      "Removed from Verified and the fee is forfeited — the place stays in the catalog.",
  },
];

function MembershipBox({
  isMember,
  currency,
}: {
  isMember: boolean;
  currency: string;
}) {
  const [notice, setNotice] = useState(false);
  return (
    <Section
      title="Verified membership"
      description="The commitment that turns on paid promos."
      right={<StatusPill active={isMember} />}
    >
      <div className="border-border bg-muted/25 flex items-start gap-3 rounded-xl border p-3">
        <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">
            {formatMoney(MEMBERSHIP_FEE_MXN, currency)}{" "}
            <span className="text-muted-foreground text-[11px] font-normal">
              / year
            </span>
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            A yearly signing fee — a security deposit against dead coupons, not a
            subscription. It buys commitment, not placement: important venues
            rank free in the organic lane, and rank is never for sale.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <FeatureRow>
          Run a paid strategy — Conservative through Dominant.
        </FeatureRow>
        <FeatureRow>Eligible for the promo lane in the Swipe deck.</FeatureRow>
        <FeatureRow muted>
          Your catalog listing and the free organic lane never go away.
        </FeatureRow>
      </div>

      <SubHeading icon={Ticket}>Activation</SubHeading>
      <div className="flex flex-col gap-1.5">
        <ActivationStep icon={MessageCircle}>
          Your staff WhatsApp channel passes a test ping.
        </ActivationStep>
        <ActivationStep icon={Ticket}>
          The first guest ticket is honored at the bill.
        </ActivationStep>
      </div>

      <SubHeading icon={AlertTriangle}>If you turn a guest away</SubHeading>
      <div className="border-border overflow-hidden rounded-xl border">
        {STRIKES.map((s, i) => (
          <div
            key={s.n}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5",
              i > 0 && "border-border border-t",
            )}
          >
            <span
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                s.n === "3"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/15 text-amber-700",
              )}
            >
              {s.n}
            </span>
            <span className="text-foreground/80 text-[11px] leading-snug">
              {s.consequence}
            </span>
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-[11px] leading-snug">
        A refused or ignored QR is a strike. Strikes decay after 6 months clean,
        and a guest who&apos;s turned away is compensated instantly.
      </p>

      {!isMember &&
        (notice ? (
          <p className="rounded-lg bg-emerald-50 p-3 text-[11px] leading-snug text-emerald-800">
            Noted — Mesita will reach out on your staff WhatsApp to run the test
            ping and switch Verified on.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setNotice(true)}
            className="bg-foreground text-background inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold transition hover:opacity-90"
          >
            <ShieldCheck className="h-4 w-4" />
            Request activation
          </button>
        ))}
    </Section>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase",
        active
          ? "bg-emerald-500/12 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {active ? "Active" : "Not active"}
    </span>
  );
}

function FeatureRow({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Check
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          muted ? "text-muted-foreground" : "text-primary",
        )}
      />
      <span
        className={cn(
          "text-[12px] leading-snug",
          muted ? "text-muted-foreground" : "text-foreground/85",
        )}
      >
        {children}
      </span>
    </div>
  );
}

function SubHeading({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
        {children}
      </span>
    </div>
  );
}

function ActivationStep({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card flex items-center gap-2.5 rounded-xl border px-3 py-2">
      <span className="bg-muted/70 text-foreground/70 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-foreground/80 text-[12px] leading-snug">
        {children}
      </span>
    </div>
  );
}
