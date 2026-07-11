"use client";

import { Fragment, useState, useTransition } from "react";
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
import { dbStateForSubscription } from "@/lib/business/plans";
import { updatePlace, type AdminPlace } from "../actions";
import { SectionCard, GroupLabel, ErrorNote } from "../ui";

// Admin Promos — Buzz v4 (mirrors the business console, MESITA-511). Two boxes:
//   1. Strategy   — pick ONE of four presets (Zero → Dominant); each writes the
//                   four per-tier rate columns + the universal cap in one save.
//   2. Membership — the MX$1,000/year Verified signing fee + strikes. Admin can
//                   flip a place Verified/Zero directly (its plan-write power),
//                   where the business console only shows an activation request.
//
// Writes go through the same `business-web-update-project` EF (super-admin
// elevated), whose legal rate set + the coupon snapshot CHECK already accept
// the tens grid {10,20,30,40,50}.

const MEMBERSHIP_FEE_MXN = 1000;

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

// "MX$1,000" for MXN places; generic "$" prefix elsewhere.
function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

// Verified = any paid plan (free ⇒ not a member, Zero only). Plan enum still
// carries pro/ultra/informal_* — anything non-free counts as Verified.
function isVerifiedMember(place: AdminPlace): boolean {
  return !!place.plan && place.plan !== "free";
}

export function PromosSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Optimistic write: patch local + bubble, persist, revert on error.
  const persist = (patch: Record<string, unknown>) => {
    const prev = v;
    const next = { ...v, ...patch } as AdminPlace;
    setV(next);
    onSaved(next);
    setError(null);
    start(async () => {
      const r = await updatePlace({ id: v.id, ...patch });
      if (!r.ok) {
        setV(prev);
        onSaved(prev);
        setError(r.error);
        return;
      }
      setV(r.data);
      onSaved(r.data);
    });
  };

  const isMember = isVerifiedMember(v);
  // Which preset the live (optimistic) rates reflect; null = custom/legacy.
  const storedStrategy = strategyForPlace(v);
  const activeStrategy = STRATEGY_BY_ID[storedStrategy ?? "zero"];

  const applyStrategy = (target: StrategyId) => {
    if (pending || target === storedStrategy) return;
    // Paid strategies require Verified membership; Zero is always available.
    if (target !== "zero" && !isMember) return;
    const s = STRATEGY_BY_ID[target];
    persist({
      welcome_free_rate: s.rates.welcome_free_rate,
      welcome_premium_rate: s.rates.welcome_premium_rate,
      free_rate: s.rates.free_rate,
      premium_rate: s.rates.premium_rate,
      monthly_promo_cap: s.cap,
    });
  };

  // Admin flips membership directly (business owner can't). "pro_discount"
  // maps to plan=informal_pro; "free" clears it back to Zero.
  const setMembership = (member: boolean) => {
    if (pending || member === isMember) return;
    persist(dbStateForSubscription(member ? "pro_discount" : "free"));
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="pink"
        title="Discount strategy"
        subtitle="Pick one posture. A stronger discount reads as a stronger card and shows this place to more guests. Big to win them, fair to keep them — Premium guests always get more."
        action={
          pending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : null
        }
      >
        <CapBanner currency={v.currency} />

        {!isMember && (
          <div className="border-border/60 bg-muted/30 text-foreground/75 mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px]">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            <span>
              Only <span className="font-semibold">Zero</span> is available until
              this place is Verified — set it in Membership below.
            </span>
          </div>
        )}

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {STRATEGIES.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              selected={s.id === storedStrategy}
              pending={pending && s.id === storedStrategy}
              locked={s.id !== "zero" && !isMember}
              onSelect={() => applyStrategy(s.id)}
            />
          ))}
        </div>

        {storedStrategy === null && (
          <p className="text-muted-foreground mt-3 text-[11px]">
            Current rates don&apos;t match a preset — pick a strategy to
            standardize them.
          </p>
        )}

        <div className="mt-4">
          <SelectedMatrix strategy={activeStrategy} currency={v.currency} />
        </div>
        <div className="mt-4">
          <VisibilityRail visibility={activeStrategy.visibility} />
        </div>

        {error && (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        )}
      </SectionCard>

      <SectionCard
        icon={<ShieldCheck className="h-4 w-4" />}
        tint="violet"
        title="Verified membership"
        subtitle="The commitment that turns on paid promos — an MX$1,000/year signing fee."
        action={<StatusPill active={isMember} />}
      >
        <MembershipBody
          isMember={isMember}
          currency={v.currency}
          pending={pending}
          onSet={setMembership}
        />
      </SectionCard>
    </div>
  );
}

// ── Box 1 · Strategy ─────────────────────────────────────────────────────────

// Universal cap — always displayed. The discount only ever applies to the
// first MX$500 of the bill, so a headline percentage stays a bounded cost.
function CapBanner({ currency }: { currency: string | null }) {
  return (
    <div className="border-border/60 bg-muted/30 flex items-center gap-2 rounded-xl border px-3 py-2">
      <Percent className="h-4 w-4 shrink-0 text-pink-600" />
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
  const top = strategy.rates.welcome_premium_rate;
  return (
    <button
      type="button"
      onClick={locked ? undefined : onSelect}
      disabled={pending || locked}
      aria-pressed={selected}
      className={cx(
        "relative flex flex-col gap-2 rounded-2xl border p-3.5 text-left transition",
        selected
          ? "border-foreground/80 shadow-elev ring-foreground/10 bg-card ring-1"
          : "border-border bg-card",
        !selected &&
          !locked &&
          "hover:border-foreground/30 hover:-translate-y-0.5 hover:shadow-card",
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
            <span className="font-display text-2xl leading-none font-bold tabular-nums text-pink-600">
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

// The exact discount the selected strategy offers, Welcome/Returning ×
// Free/Premium. Premium column tinted violet so "Premium gets more" reads fast.
function SelectedMatrix({
  strategy,
  currency,
}: {
  strategy: Strategy;
  currency: string | null;
}) {
  if (strategy.id === "zero") {
    return (
      <div className="border-border/60 bg-muted/20 rounded-xl border border-dashed px-3 py-3 text-center">
        <p className="text-muted-foreground text-[12px] leading-snug">
          No discounts on Zero — this place still appears in the catalog and the
          free organic lane.
        </p>
      </div>
    );
  }
  const r = strategy.rates;
  return (
    <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
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
      <div className="border-border/60 text-muted-foreground border-t px-3 py-1.5 text-[10px]">
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
      className={cx(
        "border-border/60 border-b px-3 py-2 text-[10px] font-bold tracking-wide uppercase",
        center && "text-center",
        premium ? "bg-violet-500/10 text-violet-600" : "text-muted-foreground",
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
      className={cx(
        "text-foreground/70 px-3 py-2.5 text-[11px] font-semibold",
        !last && "border-border/60 border-b",
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
      className={cx(
        "flex items-center justify-center px-3 py-2.5 tabular-nums",
        !last && "border-border/60 border-b",
        premium && "bg-violet-500/[0.06]",
      )}
    >
      {value == null ? (
        <span className="text-muted-foreground text-sm">—</span>
      ) : (
        <span
          className={cx(
            "font-display text-lg leading-none font-bold",
            premium ? "text-violet-600" : "text-foreground/80",
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
        <GroupLabel>Visibility</GroupLabel>
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
                  className={cx(
                    "h-1.5 flex-1 rounded-full",
                    i <= currentIdx ? "bg-pink-gradient" : "bg-muted/80",
                  )}
                />
              )}
              <div
                className={cx(
                  "shrink-0 rounded-full transition",
                  isCurrent
                    ? "bg-pink-gradient shadow-save h-4 w-4 ring-4 ring-pink-500/25"
                    : i < currentIdx
                      ? "bg-pink-gradient h-3 w-3"
                      : "bg-muted/80 h-3 w-3",
                )}
              />
            </Fragment>
          );
        })}
      </div>
      <div className="flex justify-between text-[9px] font-semibold tracking-wider uppercase">
        {STRATEGY_VISIBILITY_LADDER.map((level, i) => (
          <span
            key={level}
            className={
              i === currentIdx ? "text-foreground" : "text-muted-foreground/70"
            }
          >
            {level}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Box 2 · Membership ───────────────────────────────────────────────────────

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "Warning, and the activation test is re-run." },
  { n: "2", consequence: "The promo lane is paused for 30 days." },
  {
    n: "3",
    consequence:
      "Removed from Verified and the fee is forfeited — the place stays in the catalog.",
  },
];

function MembershipBody({
  isMember,
  currency,
  pending,
  onSet,
}: {
  isMember: boolean;
  currency: string | null;
  pending: boolean;
  onSet: (member: boolean) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-4">
      <div className="border-border/60 bg-muted/25 flex items-start gap-3 rounded-xl border p-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
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

      {/* Admin control — flip Verified on/off directly (writes plan). */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground text-[11px] font-medium">
          Set membership:
        </span>
        <ToggleButton
          active={isMember}
          disabled={pending}
          onClick={() => onSet(true)}
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Verified
        </ToggleButton>
        <ToggleButton
          active={!isMember}
          disabled={pending}
          onClick={() => onSet(false)}
        >
          Zero (unpaid)
        </ToggleButton>
      </div>

      <div className="flex flex-col gap-1.5">
        <FeatureRow>
          Run a paid strategy — Conservative through Dominant.
        </FeatureRow>
        <FeatureRow>Eligible for the promo lane in the Swipe deck.</FeatureRow>
        <FeatureRow muted>
          The catalog listing and the free organic lane never go away.
        </FeatureRow>
      </div>

      <div>
        <SubHeading icon={Ticket}>Activation</SubHeading>
        <div className="mt-2 flex flex-col gap-1.5">
          <ActivationStep icon={MessageCircle}>
            The staff WhatsApp channel passes a test ping.
          </ActivationStep>
          <ActivationStep icon={Ticket}>
            The first guest ticket is honored at the bill.
          </ActivationStep>
        </div>
      </div>

      <div>
        <SubHeading icon={AlertTriangle}>If a guest is turned away</SubHeading>
        <div className="border-border/60 mt-2 overflow-hidden rounded-xl border">
          {STRIKES.map((s, i) => (
            <div
              key={s.n}
              className={cx(
                "flex items-center gap-3 px-3 py-2.5",
                i > 0 && "border-border/60 border-t",
              )}
            >
              <span
                className={cx(
                  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  s.n === "3"
                    ? "bg-rose-500/10 text-rose-600"
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
        <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
          A refused or ignored QR is a strike. Strikes decay after 6 months
          clean, and a guest who&apos;s turned away is compensated instantly.
        </p>
      </div>
    </div>
  );
}

function ToggleButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || active}
      onClick={onClick}
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-default",
        active
          ? "border-transparent bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase",
        active
          ? "bg-emerald-500/12 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {active ? "Verified" : "Not verified"}
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
        className={cx(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          muted ? "text-muted-foreground" : "text-pink-600",
        )}
      />
      <span
        className={cx(
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
    <div className="flex items-center gap-1.5">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <GroupLabel>{children}</GroupLabel>
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
    <div className="border-border/60 bg-card flex items-center gap-2.5 rounded-xl border px-3 py-2">
      <span className="bg-muted/70 text-foreground/70 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-foreground/80 text-[12px] leading-snug">
        {children}
      </span>
    </div>
  );
}
