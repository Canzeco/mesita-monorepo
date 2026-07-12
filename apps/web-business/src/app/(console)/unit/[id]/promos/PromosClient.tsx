"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  Crown,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Ticket,
  X,
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

// Promos — Buzz v4.1 pricing cards + product modal (mirrors admin MESITA-584).
//   1. Subscription — FOUR pricing cards with generated art bands. The whole
//      card is the click target: it opens a product modal with the full
//      detail (what you give / what you get back / the commitment) and the
//      action footer — the modal IS the confirm-and-pay step. Three products
//      cost the SAME MX$1,000/year; switching products is a NEW subscription
//      (the lock-in).
//   2. The subscription — fee framing, activation steps, strikes ladder.
//   3. Premium example — what the current rates feel like at the bill.
//
// Plan is billing-locked from this console: a place NOT yet subscribed gets
// the subscribe-and-pay journey inside the modal, which completes as an
// activation request (Mesita pings the staff WhatsApp; payment is settled
// with the account manager — nothing is charged in-app). A subscribed place
// switches rates directly (the write is rates + cap only, never plan).

const PRODUCT_PRICE_MXN = 1000;

// Sample ticket for the worked example — above the universal cap on purpose,
// so the "first MX$500" rule is visible in the math.
const EXAMPLE_BILL_MXN = 700;

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text
// in pixels — copy stays HTML); the gradient paints behind the image so a
// slow or missing asset still renders a branded band.
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

function formatMoney(amount: number, currency: string): string {
  const prefix = currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

// A place on any product carries a subscription (plan != free).
function isSubscribed(place: MyPlace): boolean {
  return place.plan !== "free";
}

// ─── Client ──────────────────────────────────────────────────────────────

export function PromosClient({ place }: { place: MyPlace }) {
  const router = useRouter();
  const supabase = useBrowserSupabase();

  const subscribed = isSubscribed(place);

  // The product the stored rates currently reflect (null = custom/legacy).
  const storedStrategy = strategyForPlace(place);
  const [selectedId, setSelectedId] = useState<StrategyId | null>(storedStrategy);
  const [pendingId, setPendingId] = useState<StrategyId | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);
  // Paid product requested by a not-yet-subscribed place → persistent notice.
  const [activationFor, setActivationFor] = useState<StrategyId | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Writes the four rate columns + the cap atomically (never plan — that is
  // billing). Optimistic: the card flips immediately and reverts on failure.
  const commitStrategy = (target: StrategyId) => {
    setModalId(null);
    if (pendingId || target === selectedId) return;
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
        setError(errMsg(err, "Couldn't save the product."));
      })
      .finally(() => setPendingId(null));
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;
  const activationStrategy = activationFor
    ? STRATEGY_BY_ID[activationFor]
    : null;

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 pb-10">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Promos
        </h2>
        <p className="text-muted-foreground text-[13px] leading-snug">
          Three products, one price — what changes is the discounts you give,
          and the visibility the algorithm gives back.
        </p>
      </header>

      {/* ── Box 1 · Subscription (four pricing cards) ─────────────────── */}
      <Section
        title="Subscription"
        description={`${formatMoney(PRODUCT_PRICE_MXN, place.currency)}/year each for the paid three — tap a card for the full detail. Every discount applies to the first ${formatMoney(UNIVERSAL_CAP_MXN, place.currency)} of the bill.`}
        right={<StatusPill subscribed={subscribed} />}
      >
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
          {STRATEGIES.map((s) => (
            <PricingCard
              key={s.id}
              strategy={s}
              currency={place.currency}
              selected={s.id === selectedId}
              pending={pendingId === s.id}
              subscribed={subscribed}
              onOpen={() => setModalId(s.id)}
            />
          ))}
        </div>

        {activationStrategy && (
          <p className="rounded-xl bg-emerald-50 p-3 text-[12px] leading-snug text-emerald-800">
            Noted — Mesita will reach out on your staff WhatsApp to run the
            test ping and activate{" "}
            <span className="font-semibold">
              {activationStrategy.emoji} {activationStrategy.name}
            </span>{" "}
            ({formatMoney(PRODUCT_PRICE_MXN, place.currency)}/year). Nothing is
            charged until then.
          </p>
        )}

        {selectedId === null && (
          <p className="text-muted-foreground text-[11px]">
            Your current rates don&apos;t match a product — pick one to
            standardize them.
          </p>
        )}

        <p className="text-muted-foreground text-[11px] leading-snug">
          Same price on every product keeps rank off the market — you buy a
          commitment to give, not placement. Switching products later is a new{" "}
          {formatMoney(PRODUCT_PRICE_MXN, place.currency)}/year subscription.
        </p>

        {error && <p className={ERROR_BOX_CLASS}>{error}</p>}
      </Section>

      {/* ── Box 2 · The subscription (fee, activation, strikes) ──────── */}
      <SubscriptionBox currency={place.currency} />

      {/* ── Box 3 · Premium guest example ─────────────────────────────── */}
      <PremiumExampleBox place={place} storedStrategy={storedStrategy} />

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          currency={place.currency}
          isCurrent={modalStrategy.id === selectedId}
          subscribed={subscribed}
          onCommit={() => commitStrategy(modalStrategy.id)}
          onRequestActivation={() => setActivationFor(modalStrategy.id)}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}

// ─── Pricing card (whole card opens the product modal) ──────────────────

function PricingCard({
  strategy,
  currency,
  selected,
  pending,
  subscribed,
  onOpen,
}: {
  strategy: Strategy;
  currency: string;
  selected: boolean;
  pending: boolean;
  subscribed: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== "zero";
  const top = strategy.rates.welcome_premium_rate;
  const r = strategy.rates;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${strategy.name} — details${selected ? " (current product)" : ""}`}
      className={cn(
        "bg-card relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border motion-safe:hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-20px_rgba(236,72,153,0.35)]",
      )}
    >
      {/* Art band — gradient behind the image is the loading/404 fallback;
          the scrim keeps the white name/price legible. */}
      <div className={cn("relative h-28 w-full shrink-0 bg-gradient-to-br", art.fallback)}>
        <Image
          src={art.src}
          alt=""
          fill
          sizes="(min-width:480px) 50vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        {selected && (
          <span className="text-foreground absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
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
                <span className="font-normal text-white/80">/ year</span>
              </>
            ) : (
              "Free"
            )}
          </p>
        </div>
      </div>

      {/* Body — the differentiator leads: identical prices can't be the hero. */}
      <div className="flex w-full flex-1 flex-col gap-2.5 p-3.5">
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
          <VisibilityMeter visibility={strategy.visibility} accent={art.meter} />

          <p className="text-muted-foreground text-[10px] leading-snug">
            {paid
              ? `Off the first ${formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} of the bill.`
              : "Catalog and free organic lane only."}
          </p>

          {/* Presentational CTA — the whole card is the button; the modal
              carries the real action. */}
          {selected ? (
            <span className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-[12px] font-bold">
              <Check className="h-3.5 w-3.5" />
              Current
            </span>
          ) : paid ? (
            <span
              className={cn(
                "inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r text-[12px] font-bold text-white",
                art.cta,
              )}
            >
              {subscribed ? "Switch" : "Subscribe"}
            </span>
          ) : (
            <span className="border-border text-foreground/75 inline-flex h-11 w-full items-center justify-center rounded-full border text-[12px] font-bold">
              Drop to Zero
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Product modal — full detail + the subscribe/pay step ───────────────────

function ProductModal({
  strategy,
  currency,
  isCurrent,
  subscribed,
  onCommit,
  onRequestActivation,
  onClose,
}: {
  strategy: Strategy;
  currency: string;
  isCurrent: boolean;
  subscribed: boolean;
  onCommit: () => void;
  onRequestActivation: () => void;
  onClose: () => void;
}) {
  // Subscribe-and-pay for a not-yet-subscribed place completes in-modal as an
  // activation request (billing is settled with the account manager).
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== "zero";
  const r = strategy.rates;
  const needsActivation = paid && !subscribed;

  const primaryLabel = isCurrent
    ? "Current product"
    : paid
      ? subscribed
        ? `Switch to ${strategy.name}`
        : `Subscribe — ${formatMoney(PRODUCT_PRICE_MXN, currency)}/year`
      : "Drop to Zero";

  const onPrimary = () => {
    if (isCurrent) return;
    if (needsActivation) {
      onRequestActivation();
      setRequested(true);
      return;
    }
    onCommit();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Dismiss"
        className="absolute inset-0 bg-black/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-modal-title"
        className="border-border bg-card relative z-10 flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-xl"
      >
        {/* Art header */}
        <div className={cn("relative h-32 shrink-0 bg-gradient-to-br", art.fallback)}>
          <Image src={art.src} alt="" fill sizes="28rem" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-2.5 right-2.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/50"
          >
            <X className="h-4 w-4" />
          </button>
          {isCurrent && (
            <span className="text-foreground absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase shadow-sm">
              <Check className="h-3 w-3" />
              Current
            </span>
          )}
          <div className="absolute inset-x-4 bottom-3">
            <p
              id="product-modal-title"
              className="font-display text-lg font-bold tracking-wide text-white uppercase drop-shadow-sm"
            >
              <span className="mr-1.5" aria-hidden>
                {strategy.emoji}
              </span>
              {strategy.name}
            </p>
            <p className="text-[12px] font-semibold text-white/90 drop-shadow-sm">
              {paid ? (
                <>
                  {formatMoney(PRODUCT_PRICE_MXN, currency)}{" "}
                  <span className="font-normal text-white/80">/ year</span>
                </>
              ) : (
                "Free"
              )}
            </p>
          </div>
        </div>

        {requested ? (
          /* Subscribe-and-pay confirmation state */
          <div className="flex flex-col gap-4 p-5">
            <div className="flex flex-col items-center gap-3 rounded-xl bg-emerald-50 px-4 py-6 text-center">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15">
                <Check className="h-5 w-5 text-emerald-600" />
              </span>
              <p className="text-[13px] leading-snug font-semibold text-emerald-900">
                {strategy.emoji} {strategy.name} requested
              </p>
              <p className="text-[12px] leading-snug text-emerald-800">
                Mesita will reach out on your staff WhatsApp to run the test
                ping and activate the subscription. Payment (
                {formatMoney(PRODUCT_PRICE_MXN, currency)}/year) is settled
                with your account manager — nothing is charged in-app.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="bg-foreground text-background inline-flex h-11 w-full items-center justify-center rounded-full text-[13px] font-bold transition hover:opacity-90"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            {/* Detail */}
            <div className="flex flex-col gap-4 overflow-y-auto p-5">
              <p className="text-muted-foreground text-[13px] leading-snug">
                {strategy.tagline}
              </p>

              <div className="flex flex-col gap-2">
                <ModalLabel>What you give</ModalLabel>
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
                  <SegmentRow
                    rate={r.welcome_free_rate}
                    label="Free · first visit"
                  />
                  <SegmentRow rate={r.free_rate} label="Free · returning" />
                </div>
                {paid && (
                  <p className="text-muted-foreground text-[11px] leading-snug">
                    Every discount applies to the first{" "}
                    {formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)}{" "}
                    of the bill — a platform-wide cap, always shown to guests.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <ModalLabel>What you get back</ModalLabel>
                <VisibilityMeter
                  visibility={strategy.visibility}
                  accent={art.meter}
                />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  {paid
                    ? `The ranking algorithm reads a stronger discount as a stronger card — ${strategy.visibility} visibility in the Swipe deck, plus promo-lane eligibility.`
                    : "The catalog listing and the free organic lane — always on, subscribed or not."}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <ModalLabel>The commitment</ModalLabel>
                {paid ? (
                  <div className="flex flex-col gap-1.5">
                    <CommitmentRow icon={ShieldCheck}>
                      {formatMoney(PRODUCT_PRICE_MXN, currency)}/year, per
                      product — switching later is a NEW subscription. Same
                      price on every product: rank is never for sale.
                    </CommitmentRow>
                    <CommitmentRow icon={MessageCircle}>
                      Activation: your staff WhatsApp passes a test ping and
                      the first guest ticket is honored at the bill.
                    </CommitmentRow>
                    <CommitmentRow icon={AlertTriangle}>
                      Strikes for turning a guest away: 1 warning · 2 promo
                      lane paused 30 days · 3 removed and the fee is
                      forfeited. Strikes decay after 6 months clean.
                    </CommitmentRow>
                  </div>
                ) : (
                  <CommitmentRow icon={ShieldCheck}>
                    No fee, no commitment — dropping to Zero clears your rates
                    and paid promos stop. You can subscribe again any time.
                  </CommitmentRow>
                )}
              </div>
            </div>

            {/* Action footer */}
            <div className="border-border flex flex-col gap-2 border-t p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold">
                  {paid ? (
                    <>
                      {formatMoney(PRODUCT_PRICE_MXN, currency)}
                      <span className="text-muted-foreground text-[11px] font-normal">
                        {" "}
                        / year
                      </span>
                    </>
                  ) : (
                    "Free"
                  )}
                </span>
                <button
                  type="button"
                  disabled={isCurrent}
                  onClick={onPrimary}
                  className={cn(
                    "inline-flex h-11 items-center justify-center rounded-full px-5 text-[13px] font-bold transition",
                    isCurrent
                      ? "border-border text-muted-foreground border"
                      : paid
                        ? cn(
                            "bg-gradient-to-r text-white hover:brightness-105 active:scale-[0.99]",
                            art.cta,
                          )
                        : "border-border text-foreground hover:bg-muted border",
                  )}
                >
                  {isCurrent && <Check className="mr-1.5 h-3.5 w-3.5" />}
                  {primaryLabel}
                </button>
              </div>
              <p className="text-muted-foreground text-[10px] leading-snug">
                {needsActivation
                  ? "Payment is settled with your Mesita account manager — nothing is charged in-app."
                  : subscribed && paid && !isCurrent
                    ? "Rates change now — Mesita follows up on the billing."
                    : ""}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModalLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-muted-foreground text-[10px] font-bold tracking-[0.16em] uppercase">
      {children}
    </span>
  );
}

function CommitmentRow({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="bg-muted/70 text-foreground/70 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="text-foreground/80 text-[12px] leading-snug">
        {children}
      </span>
    </div>
  );
}

// One discount segment: ✓ + rate when the product grants it, ✗ + em-dash when
// it doesn't (Zero) — rates live in HTML text, never in the artwork.
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
        className={cn(
          "w-9 shrink-0 font-bold tabular-nums",
          !on
            ? "text-muted-foreground/50"
            : premium
              ? "text-tier-premium"
              : "text-foreground/80",
        )}
      >
        {on ? `${rate}%` : "—"}
      </span>
      <span
        className={cn(
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
    <div className="border-border flex flex-col gap-1.5 border-t pt-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[9px] font-bold tracking-[0.14em] uppercase">
          In exchange · visibility
        </span>
        <span className="text-[11px] leading-none font-bold">{visibility}</span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {STRATEGY_VISIBILITY_LADDER.map((lvl, i) => (
          <span
            key={lvl}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              i <= idx ? accent : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Box 2 · The subscription (fee, activation, strikes) ────────────────────

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "Warning, and we re-run the activation test." },
  { n: "2", consequence: "Your promo lane is paused for 30 days." },
  {
    n: "3",
    consequence:
      "Removed from the paid products and the fee is forfeited — the place stays in the catalog.",
  },
];

function SubscriptionBox({ currency }: { currency: string }) {
  return (
    <Section
      title="The subscription"
      description="What the fee is, how activation works, and what a strike costs."
    >
      <div className="border-border bg-muted/25 flex items-start gap-3 rounded-xl border p-3">
        <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold">
            {formatMoney(PRODUCT_PRICE_MXN, currency)}{" "}
            <span className="text-muted-foreground text-[11px] font-normal">
              / year · per product
            </span>
          </p>
          <p className="text-muted-foreground text-[11px] leading-snug">
            A commitment filter, not a feature tier — it keeps half-hearted
            restaurants out of the rewards program and guests away from dead
            coupons. It buys commitment, never placement: rank is not for
            sale.
          </p>
        </div>
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
        A refused or ignored QR is a strike. Strikes decay after 6 months
        clean, and a guest who&apos;s turned away is compensated instantly.
      </p>
    </Section>
  );
}

// ─── Box 3 · Premium guest example ──────────────────────────────────────────

// Worked from the place's LIVE rate columns (not the preset), so custom or
// legacy rates preview exactly what the bill EF would apply today.
function PremiumExampleBox({
  place,
  storedStrategy,
}: {
  place: MyPlace;
  storedStrategy: StrategyId | null;
}) {
  const hasPromo =
    place.welcome_premium_rate != null || place.premium_rate != null;
  const strategy = storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;
  const cap = place.monthly_promo_cap ?? UNIVERSAL_CAP_MXN;

  return (
    <Section
      title="What a Premium guest gets"
      description={`The current rates worked on a sample ${formatMoney(EXAMPLE_BILL_MXN, place.currency)} ticket.`}
      right={
        hasPromo ? (
          <span className="bg-muted text-foreground/70 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
            {strategy && strategy.id !== "zero"
              ? `${strategy.emoji} ${strategy.name}`
              : "Custom rates"}
          </span>
        ) : undefined
      }
    >
      {hasPromo ? (
        <>
          <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
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
          <p className="text-muted-foreground text-[11px] leading-snug">
            Premium ≥ Free in every product — Premium guests always get the
            better deal. They are what the subscription buys.
          </p>
        </>
      ) : (
        <div className="border-border bg-muted/20 rounded-xl border border-dashed px-4 py-5 text-center">
          <p className="text-muted-foreground text-[12px] leading-snug">
            No promos right now — Premium guests see your place in the catalog
            with no discount card. Activate a product above to preview the
            deal.
          </p>
        </div>
      )}
    </Section>
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
  currency: string;
}) {
  // The discount only touches the first `cap` of the ticket.
  const base = Math.min(EXAMPLE_BILL_MXN, cap);
  const saves = premiumRate == null ? 0 : Math.round((base * premiumRate) / 100);
  const pays = EXAMPLE_BILL_MXN - saves;
  const freeSaves = freeRate == null ? 0 : Math.round((base * freeRate) / 100);

  return (
    <div className="border-border bg-tier-premium/[0.04] rounded-xl border p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {visit}
        </span>
        <span className="bg-tier-premium/10 text-tier-premium inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold">
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
            <span className="text-tier-premium text-2xl leading-none font-bold tabular-nums">
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
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase",
        subscribed
          ? "bg-emerald-500/12 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          subscribed ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {subscribed ? "Subscribed" : "Free"}
    </span>
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
