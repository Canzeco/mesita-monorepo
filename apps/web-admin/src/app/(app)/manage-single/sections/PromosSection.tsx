"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Check, Crown, Loader2, Percent, X } from "lucide-react";
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
import { SectionCard, ErrorNote, ConfirmDialog } from "../ui";

// Admin Promos — Buzz v4.1, pricing-card selector (MESITA-576, design-reviewed).
//   1. Subscription — FOUR pricing cards (Zero is a peer card again): generated
//      art band with name + price, then the differentiator (identical prices
//      can't be the hero, the discount schedule is): "up to N%", four ✓/✗
//      segment rows, the visibility the algorithm gives in exchange, and a CTA.
//      Three paid products cost the SAME MX$1,000/year — you buy commitment,
//      not placement; switching products is a NEW subscription (the lock-in).
//      One confirm-gated tap writes rates + cap + paying plan flags atomically.
//   2. Premium example — what the current rates feel like at the bill for a
//      Premium guest, worked on a sample ticket.

const PRODUCT_PRICE_MXN = 1000;

// Sample ticket for the worked example — deliberately above the universal cap
// so the "first MX$500" rule is visible in the math.
const EXAMPLE_BILL_MXN = 700;

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text in
// pixels — copy stays HTML); the gradient paints behind the image so a slow or
// missing asset still renders a branded band. Dominant is plum+GOLD on purpose
// (not default-AI blue-purple).
const CARD_ART: Record<
  StrategyId,
  { src: string; fallback: string; cta: string; meter: string }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    meter: "bg-slate-400",
  },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    meter: "bg-emerald-500",
  },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    meter: "bg-orange-500",
  },
  dominant: {
    src: "/promos/strategy-dominant.jpg",
    fallback: "from-purple-950 to-amber-500",
    cta: "from-purple-700 via-fuchsia-600 to-amber-500",
    meter: "bg-purple-500",
  },
};

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
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
      {/* ── Box 1 · Subscription (four pricing cards) ────────────────────── */}
      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="pink"
        title="Subscription"
        subtitle={`Four postures, one price for the paid three — ${formatMoney(PRODUCT_PRICE_MXN, v.currency)}/year each. The discounts you give buy the visibility the algorithm gives back.`}
        action={
          <span className="flex items-center gap-2">
            {pending && (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            )}
            <StatusPill subscribed={subscribed} />
          </span>
        }
      >
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {STRATEGIES.map((s) => (
            <PricingCard
              key={s.id}
              strategy={s}
              currency={v.currency}
              selected={s.id === storedStrategy}
              subscribed={subscribed}
              pending={pending}
              onSelect={() => requestStrategy(s.id)}
            />
          ))}
        </div>

        {storedStrategy === null && (
          <p className="text-muted-foreground mt-2.5 text-[11px]">
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

// ─── Pricing card ───────────────────────────────────────────────────────────

function PricingCard({
  strategy,
  currency,
  selected,
  subscribed,
  pending,
  onSelect,
}: {
  strategy: Strategy;
  currency: string | null;
  selected: boolean;
  subscribed: boolean;
  pending: boolean;
  onSelect: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== "zero";
  const top = strategy.rates.welcome_premium_rate;
  const r = strategy.rates;

  return (
    <div
      className={cx(
        "relative flex flex-col overflow-hidden rounded-2xl border transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border/60 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-20px_rgba(0,0,0,0.35)]",
        "bg-card",
      )}
    >
      {/* Art band — gradient paints behind the image as the loading/404
          fallback; scrim keeps the white name/price ≥4.5:1. */}
      <div
        className={cx(
          "relative h-28 shrink-0 bg-gradient-to-br",
          art.fallback,
        )}
      >
        <Image
          src={art.src}
          alt=""
          fill
          sizes="(min-width:1280px) 25vw, (min-width:640px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        {selected && (
          <span className="text-foreground absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
            <Check className="h-3 w-3" />
            Current
          </span>
        )}
        <div className="absolute inset-x-3.5 bottom-2.5">
          <p className="font-display truncate text-sm font-bold tracking-wide text-white uppercase drop-shadow-sm">
            <span className="mr-1" aria-hidden>
              {strategy.emoji}
            </span>
            {strategy.name}
          </p>
          <p className="text-[11px] font-semibold text-white/90 drop-shadow-sm">
            {paid ? (
              <>
                {formatMoney(PRODUCT_PRICE_MXN, currency)}{" "}
                <span className="font-normal text-white/70">/ year</span>
              </>
            ) : (
              "Free"
            )}
          </p>
        </div>
      </div>

      {/* Body — differentiator first: identical prices can't be the hero. */}
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        {top == null ? (
          <p className="text-muted-foreground text-sm leading-none font-semibold">
            No promos
          </p>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-muted-foreground text-[11px]">up to</span>
            <span className="font-display text-2xl leading-none font-bold tabular-nums">
              {top}
              <span className="text-base">%</span>
            </span>
            <span className="text-muted-foreground text-[11px]">off</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <SegmentRow
            rate={r.welcome_premium_rate}
            label="Premium · first visit"
            premium
          />
          <SegmentRow
            rate={r.premium_rate}
            label="Premium · returning"
            premium
          />
          <SegmentRow rate={r.welcome_free_rate} label="Free · first visit" />
          <SegmentRow rate={r.free_rate} label="Free · returning" />
        </div>

        <div className="mt-auto flex flex-col gap-2.5">
          <VisibilityMeter
            visibility={strategy.visibility}
            accent={art.meter}
          />

          <p className="text-muted-foreground text-[10px] leading-snug">
            {paid
              ? `Off the first ${formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} of the bill.`
              : "Catalog and free organic lane only."}
          </p>

          {selected ? (
            <button
              type="button"
              disabled
              aria-pressed="true"
              className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-[12px] font-bold"
            >
              <Check className="h-3.5 w-3.5" />
              Current
            </button>
          ) : paid ? (
            <button
              type="button"
              onClick={onSelect}
              disabled={pending}
              aria-pressed="false"
              className={cx(
                "inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r text-[12px] font-bold text-white transition",
                "hover:brightness-105 active:scale-[0.99] disabled:opacity-60",
                art.cta,
              )}
            >
              {subscribed ? "Switch" : "Subscribe"}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSelect}
              disabled={pending}
              aria-pressed="false"
              className="border-border text-foreground/75 hover:border-foreground/40 hover:text-foreground inline-flex h-11 w-full items-center justify-center rounded-full border text-[12px] font-bold transition disabled:opacity-60"
            >
              Drop to Zero
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// One discount segment: ✓ + rate when the product grants it, ✗ + em-dash when
// it doesn't (Zero) — the rates live in HTML text, never in the artwork.
function SegmentRow({
  rate,
  label,
  premium,
}: {
  rate: number | null;
  label: string;
  premium?: boolean;
}) {
  const on = rate != null;
  return (
    <div className="flex items-center gap-2 text-[11px]">
      {on ? (
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
      ) : (
        <X className="text-muted-foreground/50 h-3.5 w-3.5 shrink-0" />
      )}
      <span
        className={cx(
          "w-9 shrink-0 font-bold tabular-nums",
          !on
            ? "text-muted-foreground/50"
            : premium
              ? "text-violet-600"
              : "text-foreground/80",
        )}
      >
        {on ? `${rate}%` : "—"}
      </span>
      <span
        className={cx(
          "truncate",
          on ? "text-foreground/75" : "text-muted-foreground/60",
        )}
      >
        {label}
      </span>
    </div>
  );
}

// What the algorithm gives back for the generosity above.
function VisibilityMeter({
  visibility,
  accent,
}: {
  visibility: StrategyVisibility;
  accent: string;
}) {
  const idx = STRATEGY_VISIBILITY_LADDER.indexOf(visibility);
  return (
    <div className="border-border/60 flex flex-col gap-1.5 border-t pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[9px] font-bold tracking-[0.14em] uppercase">
          In exchange · visibility
        </span>
        <span className="text-[11px] leading-none font-bold">
          {visibility}
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {STRATEGY_VISIBILITY_LADDER.map((lvl, i) => (
          <span
            key={lvl}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              i <= idx ? accent : "bg-muted",
            )}
          />
        ))}
      </div>
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
