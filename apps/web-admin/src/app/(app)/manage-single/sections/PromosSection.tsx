"use client";

import { useState, useTransition } from "react";
import { Check, Crown, Loader2, Percent } from "lucide-react";
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
import { SectionCard, ErrorNote, ConfirmDialog } from "../ui";

// Admin Promos — Buzz v4.1: three subscription products, one price.
//   1. Subscription — Conservative / Aggressive / Dominant, each
//      MX$1,000/year. Same price on purpose: the product IS the discount
//      schedule the place commits to giving (and the visibility that earns) —
//      deeper generosity, not a higher bill. Switching products is a NEW
//      subscription — that per-product purchase is the lock-in. Zero is not a
//      product: it is the opt-out row below the trio (catalog + organic lane
//      stay free forever). One confirm-gated tap writes the four per-tier rate
//      columns + the universal cap + the paying plan flags atomically; the
//      rates live on the cards themselves — there is no matrix to tune.
//   2. Premium example — what the current rates feel like at the bill for a
//      Premium guest, worked on a sample ticket.

const PRODUCT_PRICE_MXN = 1000;

// The three sellable products — Zero is deliberately not one of them.
const PRODUCTS = STRATEGIES.filter((s) => s.id !== "zero");

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

// A place on any product carries a subscription (plan != free).
function isSubscribed(place: AdminPlace): boolean {
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
  const [confirmId, setConfirmId] = useState<StrategyId | null>(null);

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

  const subscribed = isSubscribed(v);
  const storedStrategy = strategyForPlace(v);

  // Every product change is contract-level (a purchase, a re-purchase, or a
  // cancellation), so each one goes through the confirm guard.
  const requestStrategy = (target: StrategyId) => {
    if (pending || target === storedStrategy) return;
    setConfirmId(target);
  };
  const commitStrategy = () => {
    const target = confirmId;
    setConfirmId(null);
    if (target == null) return;
    const s = STRATEGY_BY_ID[target];
    // Rates + cap + paying flags in ONE write: the subscription IS the rates.
    persist({
      ...dbStateForSubscription(target === "zero" ? "free" : "pro_discount"),
      welcome_free_rate: s.rates.welcome_free_rate,
      welcome_premium_rate: s.rates.welcome_premium_rate,
      free_rate: s.rates.free_rate,
      premium_rate: s.rates.premium_rate,
      monthly_promo_cap: s.cap,
    });
  };

  const confirmStrategy = confirmId ? STRATEGY_BY_ID[confirmId] : null;
  const dialog = confirmStrategy
    ? dialogCopy(confirmStrategy, subscribed, v.currency)
    : null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Box 1 · Subscription (three products, one price) ────────────── */}
      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="pink"
        title="Subscription"
        subtitle={`Three products, one price — ${formatMoney(PRODUCT_PRICE_MXN, v.currency)}/year each. What changes is the discounts you give, and the visibility they earn. Always off the first ${formatMoney(UNIVERSAL_CAP_MXN, v.currency)} of the bill.`}
        action={
          <span className="flex items-center gap-2">
            {pending && (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            )}
            <StatusPill subscribed={subscribed} />
          </span>
        }
      >
        <div className="mt-3 grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {PRODUCTS.map((s) => (
            <ProductCard
              key={s.id}
              strategy={s}
              currency={v.currency}
              selected={s.id === storedStrategy}
              pending={pending && s.id === storedStrategy}
              onSelect={() => requestStrategy(s.id)}
            />
          ))}
        </div>

        <ZeroRow
          selected={storedStrategy === "zero"}
          pending={pending && storedStrategy === "zero"}
          onSelect={() => requestStrategy("zero")}
        />

        {storedStrategy === null && (
          <p className="text-muted-foreground mt-2 text-[11px]">
            Current rates don&apos;t match a product — pick one to standardize.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-1">
          <p className="text-muted-foreground text-[11px] leading-snug">
            Same price on every product keeps rank off the market — you buy a
            commitment to give, not placement. Switching products is a new{" "}
            {formatMoney(PRODUCT_PRICE_MXN, v.currency)} subscription, so
            places pick a posture and live it.
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            Admin writes plan + rates directly — no Stripe charge from here.
          </p>
        </div>

        {error && (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        )}
      </SectionCard>

      {/* ── Box 2 · Premium guest example ───────────────────────────────── */}
      <PremiumExampleBox place={v} storedStrategy={storedStrategy} />

      <ConfirmDialog
        open={dialog != null}
        title={dialog?.title ?? ""}
        body={<p>{dialog?.body}</p>}
        confirmLabel={dialog?.confirmLabel ?? "Confirm"}
        busy={pending}
        onConfirm={commitStrategy}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  );
}

// Confirm copy per transition — subscribing, switching products (the lock-in
// moment), or cancelling to Zero.
function dialogCopy(
  target: Strategy,
  subscribed: boolean,
  currency: string | null,
): { title: string; body: string; confirmLabel: string } {
  const price = formatMoney(PRODUCT_PRICE_MXN, currency);
  if (target.id === "zero") {
    return {
      title: "Drop to Zero?",
      body: "Cancels the subscription and clears the rates — paid promos stop. The catalog listing and the free organic lane stay.",
      confirmLabel: "Drop to Zero",
    };
  }
  if (!subscribed) {
    return {
      title: `Subscribe to ${target.name}?`,
      body: `${price}/year — same price as every product; this one commits the place to the ${target.name} discount schedule. Writes the rates, the cap and the paying flags — admin write only, no Stripe charge.`,
      confirmLabel: `Subscribe to ${target.name}`,
    };
  }
  return {
    title: `Switch to ${target.name}?`,
    body: `Switching products is a NEW ${price}/year subscription (that is the lock-in). Admin write only, no charge from here.`,
    confirmLabel: `Switch to ${target.name}`,
  };
}

// ─── Product cards — the FR/PR/FW/PW table, worn as chips ──────────────────

function ProductCard({
  strategy,
  currency,
  selected,
  pending,
  onSelect,
}: {
  strategy: Strategy;
  currency: string | null;
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  const top = strategy.rates.welcome_premium_rate;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={pending}
      aria-pressed={selected}
      className={cx(
        "flex flex-col gap-2 rounded-xl border p-3.5 text-left transition",
        selected
          ? "border-foreground ring-foreground/10 bg-muted/40 ring-1"
          : "border-border/60 bg-card hover:border-foreground/30 hover:bg-muted/20",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="text-base leading-none">{strategy.emoji}</span>
          <span className="truncate text-sm font-semibold tracking-tight">
            {strategy.name}
          </span>
        </span>
        {selected &&
          (pending ? (
            <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
          ) : (
            <span className="bg-foreground text-background inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
              <Check className="h-3 w-3" />
            </span>
          ))}
      </div>

      <span className="text-[11px] leading-none">
        <span className="text-foreground/80 font-semibold">
          {formatMoney(PRODUCT_PRICE_MXN, currency)}
        </span>{" "}
        <span className="text-muted-foreground">/ year</span>
      </span>

      {top != null && (
        <div className="flex items-baseline gap-1">
          <span className="text-muted-foreground text-[11px]">up to</span>
          <span className="text-xl leading-none font-bold tabular-nums">
            {top}
            <span className="text-sm">%</span>
          </span>
          <span className="text-muted-foreground text-[11px]">off</span>
        </div>
      )}

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

      <span className="bg-muted/70 text-foreground/70 mt-auto inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide">
        {strategy.visibility} visibility
      </span>
    </button>
  );
}

// Zero — the opt-out, deliberately not rendered as a product card.
function ZeroRow({
  selected,
  pending,
  onSelect,
}: {
  selected: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={pending}
      aria-pressed={selected}
      className={cx(
        "mt-2.5 flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition",
        selected
          ? "border-foreground/40 bg-muted/40"
          : "border-border/60 border-dashed bg-card hover:border-foreground/30 hover:bg-muted/20",
      )}
    >
      <span className="text-base leading-none">
        {STRATEGY_BY_ID.zero.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-semibold tracking-tight">Zero</span>{" "}
        <span className="text-muted-foreground text-[11px]">
          — no subscription. Catalog and free organic lane only, no discount
          card in the deck.
        </span>
      </span>
      <span className="text-muted-foreground shrink-0 text-[11px] font-semibold">
        Free
      </span>
      {selected &&
        (pending ? (
          <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
        ) : (
          <span className="bg-foreground text-background inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
            <Check className="h-3 w-3" />
          </span>
        ))}
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

// ─── Box 2 · Premium guest example ──────────────────────────────────────────

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
            Premium ≥ Free in every product — Premium guests always get the
            better deal. They are what the subscription buys.
          </p>
        </>
      ) : (
        <div className="border-border/60 bg-muted/20 mt-4 rounded-xl border border-dashed px-4 py-5 text-center">
          <p className="text-muted-foreground text-[12px] leading-snug">
            No promos right now — Premium guests see this place in the catalog
            with no discount card. Subscribe to a product above to preview the
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

function StatusPill({ subscribed }: { subscribed: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        subscribed
          ? "bg-emerald-500/12 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          subscribed ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {subscribed ? "Subscribed" : "Free"}
    </span>
  );
}
