"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Crown,
  Loader2,
  Lock,
  Percent,
  ShieldCheck,
} from "lucide-react";
import {
  STRATEGIES,
  STRATEGY_BY_ID,
  UNIVERSAL_CAP_MXN,
  strategyForPlace,
  type Strategy,
  type StrategyId,
} from "@/lib/business/strategies";
import { dbStateForSubscription } from "@/lib/business/plans";
import { updatePlace, type AdminPlace } from "../actions";
import { SectionCard, GroupLabel, ErrorNote, ConfirmDialog } from "../ui";

// Admin Promos — Buzz v4, three boxes top to bottom in the order the product
// gates them:
//   1. Membership — the MX$1,000/year Verified signing fee. Not a feature
//      tier: a commitment filter that keeps half-hearted restaurants out of
//      the rewards program (and guests away from dead coupons). Must be on
//      before any paid strategy.
//   2. Strategy   — members pick ONE of four postures (Zero → Dominant). One
//      tap writes the four per-tier rate columns + the universal cap; the
//      rates live on the cards themselves — there is no matrix to tune.
//   3. Premium example — what the current rates feel like at the bill for a
//      Premium guest, worked on a sample ticket.

const MEMBERSHIP_FEE_MXN = 1000;

// Sample ticket for the worked example — deliberately above the universal cap
// so the "first MX$500" rule is visible in the math.
const EXAMPLE_BILL_MXN = 700;

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

function formatPct(value: number | null): string {
  return value == null ? "—" : `${value}%`;
}

function isVerifiedMember(place: AdminPlace): boolean {
  return !!place.plan && place.plan !== "free";
}

type SaveError = { source: "membership" | "strategy"; message: string } | null;

export function PromosSection({
  place,
  onSaved,
}: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  const [pending, start] = useTransition();
  const [error, setError] = useState<SaveError>(null);
  const [memberConfirm, setMemberConfirm] = useState<boolean | null>(null);

  const persist = (
    patch: Record<string, unknown>,
    source: "membership" | "strategy",
  ) => {
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
        setError({ source, message: r.error });
        return;
      }
      setV(r.data);
      onSaved(r.data);
    });
  };

  const isMember = isVerifiedMember(v);
  const storedStrategy = strategyForPlace(v);

  const applyStrategy = (target: StrategyId) => {
    if (pending || target === storedStrategy) return;
    if (target !== "zero" && !isMember) return;
    const s = STRATEGY_BY_ID[target];
    persist(
      {
        welcome_free_rate: s.rates.welcome_free_rate,
        welcome_premium_rate: s.rates.welcome_premium_rate,
        free_rate: s.rates.free_rate,
        premium_rate: s.rates.premium_rate,
        monthly_promo_cap: s.cap,
      },
      "strategy",
    );
  };

  const requestMembership = (member: boolean) => {
    if (pending || member === isMember) return;
    setMemberConfirm(member);
  };
  const commitMembership = () => {
    const member = memberConfirm;
    setMemberConfirm(null);
    if (member == null) return;
    if (member) {
      persist(dbStateForSubscription("pro_discount"), "membership");
      return;
    }
    // Dropping membership locks the place to Zero — clear the rates in the
    // same write so the stored columns can never keep paying out a strategy
    // the place is no longer entitled to.
    const zero = STRATEGY_BY_ID.zero;
    persist(
      {
        ...dbStateForSubscription("free"),
        welcome_free_rate: zero.rates.welcome_free_rate,
        welcome_premium_rate: zero.rates.welcome_premium_rate,
        free_rate: zero.rates.free_rate,
        premium_rate: zero.rates.premium_rate,
        monthly_promo_cap: zero.cap,
      },
      "membership",
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Box 1 · Membership ──────────────────────────────────────────── */}
      <SectionCard
        icon={<ShieldCheck className="h-4 w-4" />}
        tint="emerald"
        title="Verified membership"
        subtitle={`${formatMoney(MEMBERSHIP_FEE_MXN, v.currency)}/year signing fee — the commitment gate for paid promos.`}
        action={<StatusPill active={isMember} />}
      >
        <div className="border-border/60 bg-muted/40 mt-4 flex items-start gap-3 rounded-xl border p-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {formatMoney(MEMBERSHIP_FEE_MXN, v.currency)}{" "}
              <span className="text-muted-foreground text-[11px] font-normal">
                / year
              </span>
            </p>
            <p className="text-muted-foreground mt-0.5 text-[11px] leading-snug">
              A filter, not a feature tier — the fee screens out half-hearted
              restaurants before a guest ever hits a dead coupon. It buys
              commitment, never placement: rank is not for sale.
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1.5">
          <FeatureRow>
            Unlocks the paid strategies — Conservative to Dominant.
          </FeatureRow>
          <FeatureRow>
            Makes the place eligible for the promo lane in the Swipe deck.
          </FeatureRow>
          <FeatureRow muted>
            Member or not, the catalog listing and the free organic lane never
            go away.
          </FeatureRow>
        </div>

        <div className="mt-4">
          <GroupLabel>Set membership</GroupLabel>
          <p className="text-muted-foreground mt-1 text-[11px]">
            Admin writes plan flags directly — no Stripe charge from here.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ToggleButton
              active={isMember}
              disabled={pending}
              onClick={() => requestMembership(true)}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Verified member
            </ToggleButton>
            <ToggleButton
              active={!isMember}
              disabled={pending}
              onClick={() => requestMembership(false)}
            >
              Not a member
            </ToggleButton>
          </div>
        </div>

        {error?.source === "membership" && (
          <div className="mt-3">
            <ErrorNote message={error.message} />
          </div>
        )}
      </SectionCard>

      {/* ── Box 2 · Strategy ────────────────────────────────────────────── */}
      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="pink"
        title="Discount strategy"
        subtitle={`Pick one of four postures — one tap writes every rate. Discounts always apply to the first ${formatMoney(UNIVERSAL_CAP_MXN, v.currency)} of the bill.`}
        action={
          pending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : null
        }
      >
        {!isMember && (
          <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[11px]">
            <Lock className="h-3 w-3 shrink-0" />
            Only Zero is available — activate Verified membership above to
            unlock Conservative → Dominant.
          </p>
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
          <p className="text-muted-foreground mt-2 text-[11px]">
            Current rates don&apos;t match a preset — pick one to standardize.
          </p>
        )}

        {error?.source === "strategy" && (
          <div className="mt-3">
            <ErrorNote message={error.message} />
          </div>
        )}
      </SectionCard>

      {/* ── Box 3 · Premium guest example ───────────────────────────────── */}
      <PremiumExampleBox place={v} storedStrategy={storedStrategy} />

      <ConfirmDialog
        open={memberConfirm != null}
        title={
          memberConfirm
            ? "Set this place Verified?"
            : "Remove Verified membership?"
        }
        body={
          memberConfirm ? (
            <p>Unlocks Conservative → Dominant. Does not charge Stripe.</p>
          ) : (
            <p>
              Locks the place to Zero and clears its rates — paid promos stop
              until it is Verified again.
            </p>
          )
        }
        confirmLabel={memberConfirm ? "Set Verified" : "Remove membership"}
        busy={pending}
        onConfirm={commitMembership}
        onCancel={() => setMemberConfirm(null)}
      />
    </div>
  );
}

// ─── Strategy cards — the FR/PR/FW/PW table, worn as chips ─────────────────

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
        "flex flex-col gap-2 rounded-xl border p-3.5 text-left transition",
        selected
          ? "border-foreground ring-foreground/10 bg-muted/40 ring-1"
          : "border-border/60 bg-card",
        !selected && !locked && "hover:border-foreground/30 hover:bg-muted/20",
        locked && "cursor-not-allowed opacity-55",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-base leading-none">{strategy.emoji}</span>
          <span className="truncate text-sm font-semibold tracking-tight">
            {strategy.name}
          </span>
        </span>
        {selected ? (
          pending ? (
            <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <span className="bg-foreground text-background inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
              <Check className="h-3 w-3" />
            </span>
          )
        ) : locked ? (
          <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
        ) : null}
      </div>

      {top == null ? (
        <span className="text-muted-foreground text-sm font-semibold">
          No promos
        </span>
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground text-[11px]">up to</span>
          <span className="text-xl leading-none font-bold tabular-nums">
            {top}
            <span className="text-sm">%</span>
          </span>
          <span className="text-muted-foreground text-[11px]">off</span>
        </div>
      )}

      {strategy.id === "zero" ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          Catalog and free organic lane only — no discount card in the deck.
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <RateLine
            label="First visit"
            free={strategy.rates.welcome_free_rate}
            premium={strategy.rates.welcome_premium_rate}
          />
          <RateLine
            label="Returning"
            free={strategy.rates.free_rate}
            premium={strategy.rates.premium_rate}
          />
        </div>
      )}

      <span className="bg-muted/70 text-foreground/70 mt-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide">
        {strategy.visibility} visibility
      </span>
    </button>
  );
}

function RateLine({
  label,
  free,
  premium,
}: {
  label: string;
  free: number | null;
  premium: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 tabular-nums">
        <span className="text-foreground/75">
          Free <span className="font-bold">{formatPct(free)}</span>
        </span>
        <span className="text-violet-600">
          Premium <span className="font-bold">{formatPct(premium)}</span>
        </span>
      </span>
    </div>
  );
}

// ─── Box 3 · Premium guest example ──────────────────────────────────────────

// Worked from the place's LIVE rate columns (not the preset), so custom or
// legacy rates preview exactly what the bill EF would apply today.
function PremiumExampleBox({
  place,
  storedStrategy,
}: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
}) {
  const hasPromo =
    place.welcome_premium_rate != null || place.premium_rate != null;
  const strategy = storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;
  const cap = place.monthly_promo_cap ?? UNIVERSAL_CAP_MXN;

  return (
    <SectionCard
      icon={<Crown className="h-4 w-4" />}
      tint="violet"
      title="What a Premium guest gets"
      subtitle={`The current rates worked on a sample ${formatMoney(EXAMPLE_BILL_MXN, place.currency)} ticket.`}
      action={
        hasPromo ? (
          <span className="bg-muted text-foreground/70 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            {strategy && strategy.id !== "zero"
              ? `${strategy.emoji} ${strategy.name}`
              : "Custom rates"}
          </span>
        ) : null
      }
    >
      {hasPromo ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <ExampleCard
              visit="First visit"
              premiumRate={place.welcome_premium_rate}
              freeRate={place.welcome_free_rate}
              cap={cap}
              currency={place.currency}
            />
            <ExampleCard
              visit="Returning"
              premiumRate={place.premium_rate}
              freeRate={place.free_rate}
              cap={cap}
              currency={place.currency}
            />
          </div>
          <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
            Premium ≥ Free in every preset — Premium guests always get the
            better deal. They are what the fee and the strategies are buying.
          </p>
        </>
      ) : (
        <div className="border-border/60 bg-muted/20 mt-4 rounded-xl border border-dashed px-4 py-5 text-center">
          <p className="text-muted-foreground text-[12px] leading-snug">
            No promos right now — Premium guests see this place in the catalog
            with no discount card. Pick a paid strategy above to preview the
            deal.
          </p>
        </div>
      )}
    </SectionCard>
  );
}

function ExampleCard({
  visit,
  premiumRate,
  freeRate,
  cap,
  currency,
}: {
  visit: string;
  premiumRate: number | null;
  freeRate: number | null;
  cap: number;
  currency: string | null;
}) {
  // The discount only touches the first `cap` of the ticket.
  const base = Math.min(EXAMPLE_BILL_MXN, cap);
  const saves = premiumRate == null ? 0 : Math.round((base * premiumRate) / 100);
  const pays = EXAMPLE_BILL_MXN - saves;
  const freeSaves = freeRate == null ? 0 : Math.round((base * freeRate) / 100);

  return (
    <div className="border-border/60 rounded-xl border bg-violet-500/[0.03] p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {visit}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-600">
          <Crown className="h-3 w-3" />
          Premium
        </span>
      </div>

      {premiumRate == null ? (
        <p className="text-muted-foreground mt-3 text-[12px]">
          No discount for this visit type.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-2xl leading-none font-bold text-violet-600 tabular-nums">
              {premiumRate}%
            </span>
            <span className="text-muted-foreground text-[11px]">
              off the first {formatMoney(cap, currency)}
            </span>
          </div>
          <p className="text-foreground/80 mt-2 text-[12px]">
            {formatMoney(EXAMPLE_BILL_MXN, currency)} bill → pays{" "}
            <span className="font-bold">{formatMoney(pays, currency)}</span>
            <span className="text-muted-foreground">
              {" "}
              · saves {formatMoney(saves, currency)}
            </span>
          </p>
          <p className="text-muted-foreground mt-1 text-[11px]">
            {freeRate == null
              ? "A Free guest gets no discount on this visit."
              : `A Free guest saves ${formatMoney(freeSaves, currency)} (${freeRate}%).`}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

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
        "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition disabled:cursor-default",
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
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
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
          muted ? "text-muted-foreground" : "text-emerald-600",
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
