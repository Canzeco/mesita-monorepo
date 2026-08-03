"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import {
  Check,
  ChevronDown,
  CircleHelp,
  Crown,
  Loader2,
  Percent,
  TrendingUp,
  X } from "lucide-react";
import {
  STRATEGIES,
  STRATEGY_BY_ID,
  STRATEGY_VISIBILITY_LADDER,
  UNIVERSAL_CAP_MXN,
  strategyForPlace,
  type Strategy,
  type StrategyId } from "@/lib/business/strategies";
import { planForSubscription } from "@/lib/business/plans";
import { setPlacePlan, updatePlace, type AdminPlace } from "../actions";
import {SectionCard} from "../ui";
import { ErrorNote } from "@/components/ErrorNote";

// Admin Promos — Mesita Membership (MESITA-585, card shape MESITA-590).
//   1. Mesita Membership — FOUR pricing cards, each a plain give/receive
//      pitch: YOU GIVE the MX$1,000/year membership + the discounts as a 2×2
//      matrix (Welcome/Returning × Standard/Premium, capped per bill) → YOU
//      RECEIVE {Low/Mid/High/Max} algorithm placement → Join. The whole card
//      opens the product modal (full detail + the action); switching is a
//      NEW membership (the lock-in). One tap in the modal writes rates +
//      cap + paying plan flags atomically.
//   2. FAQs — how the membership works, with real numbers: the Premium-guest
//      worked examples live in the first (default-open) item.

const MEMBERSHIP_PRICE_MXN = 1000;

// The free, no-discount strategy — the "leaving"/"not paid" boundary checked
// throughout this file.
const ZERO_STRATEGY_ID: StrategyId = "zero";

// Sample ticket for the worked example — deliberately above the universal cap
// so the "first MX$500" rule is visible in the math.
const EXAMPLE_BILL_MXN = 700;

// Per-strategy visual identity. Art = generated 1:1 abstract waves (no text
// in pixels — copy stays HTML); the gradient paints behind the image so a
// slow or missing asset still renders a branded band.
// `meter`/`recvText`/`recvBg`/`recvBorder` also drive the "You receive" reward
// panel — the payoff, colored in the strategy's own accent (MESITA-592).
const CARD_ART: Record<
  StrategyId,
  {
    src: string;
    fallback: string;
    cta: string;
    meter: string;
    recvText: string;
    recvBg: string;
    recvBorder: string;
  }
> = {
  zero: {
    src: "/promos/strategy-zero.jpg",
    fallback: "from-slate-800 to-slate-500",
    cta: "",
    meter: "bg-slate-400",
    recvText: "text-slate-500",
    recvBg: "bg-muted/40",
    recvBorder: "border-border/60" },
  conservative: {
    src: "/promos/strategy-conservative.jpg",
    fallback: "from-emerald-900 to-teal-500",
    cta: "from-emerald-600 to-teal-500",
    meter: "bg-emerald-500",
    recvText: "text-emerald-600",
    recvBg: "bg-emerald-500/[0.07]",
    recvBorder: "border-emerald-500/25" },
  aggressive: {
    src: "/promos/strategy-aggressive.jpg",
    fallback: "from-red-800 to-orange-500",
    cta: "from-red-600 to-orange-500",
    meter: "bg-orange-500",
    recvText: "text-orange-600",
    recvBg: "bg-orange-500/[0.07]",
    recvBorder: "border-orange-500/25" },
  dominant: {
    src: "/promos/strategy-dominant.jpg",
    fallback: "from-purple-950 to-amber-500",
    cta: "from-purple-700 via-fuchsia-600 to-amber-500",
    meter: "bg-purple-500",
    recvText: "text-purple-600",
    recvBg: "bg-purple-500/[0.07]",
    recvBorder: "border-purple-500/25" } };

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

// A place on any paid strategy carries a membership (plan != free).
function isMember(place: AdminPlace): boolean {
  return !!place.plan && place.plan !== "free";
}

export function PromosSection({
  place,
  onSaved }: {
  place: AdminPlace;
  onSaved: (v: AdminPlace) => void;
}) {
  const [v, setV] = useState(place);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [modalId, setModalId] = useState<StrategyId | null>(null);

  const member = isMember(v);
  const storedStrategy = strategyForPlace(v);

  // The modal is the confirm step: its footer action commits the strategy.
  //
  // A strategy is rates + cap + plan, but plan lives behind a different door:
  // business-web-update-project rejects any body carrying `plan` (that field
  // belongs to billing), so it goes through admin-web-set-plan instead. Two
  // calls can't be atomic, so order them by what a partial failure leaves
  // behind — never discounts running without the membership that pays for
  // them. Joining grants the plan first; leaving drops the rates first.
  const commitStrategy = (target: StrategyId) => {
    setModalId(null);
    if (pending || target === storedStrategy) return;
    const s = STRATEGY_BY_ID[target];
    const leaving = target === ZERO_STRATEGY_ID;
    const plan = planForSubscription(leaving ? "free" : "pro_discount");
    const rates = {
      welcome_free_rate: s.rates.welcome_free_rate,
      welcome_premium_rate: s.rates.welcome_premium_rate,
      free_rate: s.rates.free_rate,
      premium_rate: s.rates.premium_rate,
      monthly_promo_cap: s.cap };

    const prev = v;
    const optimistic: AdminPlace = { ...v, ...rates, plan };
    setV(optimistic);
    onSaved(optimistic);
    setError(null);

    start(async () => {
      const writeRates = () => updatePlace({ id: prev.id, ...rates });
      const writePlan = () => setPlacePlan(prev.id, plan);
      const writes = leaving ? [writeRates, writePlan] : [writePlan, writeRates];

      let confirmed: AdminPlace | null = null;
      for (const write of writes) {
        const r = await write();
        if (!r.ok) {
          // Show the truth, not the optimistic guess: whatever the server
          // confirmed so far, else the pre-commit state.
          const truth = confirmed ?? prev;
          setV(truth);
          onSaved(truth);
          setError(r.error);
          return;
        }
        confirmed = r.data;
      }
      if (confirmed) {
        setV(confirmed);
        onSaved(confirmed);
      }
    });
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Box 1 · Mesita Membership (four cards) ───────────────────────── */}
      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="pink"
        title="Mesita Membership"
        subtitle={`Four strategies, one price for the paid three — ${formatMoney(MEMBERSHIP_PRICE_MXN, v.currency)}/year each. Tap a card for the full detail.`}
        action={
          <span className="flex items-center gap-2">
            {pending && (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            )}
            <StatusPill member={member} />
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
              member={member}
              pending={pending && s.id === storedStrategy}
              onOpen={() => setModalId(s.id)}
            />
          ))}
        </div>

        {storedStrategy === null && (
          <p className="text-muted-foreground mt-2.5 text-[11px]">
            Current rates don&apos;t match a strategy — pick one to standardize.
          </p>
        )}

        <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
          Admin writes plan + rates directly — no Stripe charge from here.
        </p>

        {error && (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        )}
      </SectionCard>

      {/* ── Box 2 · FAQs ─────────────────────────────────────────────────── */}
      <FaqsBox place={v} storedStrategy={storedStrategy} />

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          currency={v.currency}
          isCurrent={modalStrategy.id === storedStrategy}
          member={member}
          onConfirm={() => commitStrategy(modalStrategy.id)}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}

// ─── Pricing card — simplified face; the modal carries the detail ──────────

function PricingCard({
  strategy,
  currency,
  selected,
  member,
  pending,
  onOpen }: {
  strategy: Strategy;
  currency: string | null;
  selected: boolean;
  member: boolean;
  pending: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const r = strategy.rates;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${strategy.name} — details${selected ? " (current)" : ""}`}
      className={cx(
        "bg-card relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border/60 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-20px_rgba(0,0,0,0.35)]",
      )}
    >
      {/* Art band — gradient behind the image is the loading/404 fallback;
          the scrim keeps the white name/price legible. */}
      <div
        className={cx(
          "relative h-28 w-full shrink-0 bg-gradient-to-br",
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
                {formatMoney(MEMBERSHIP_PRICE_MXN, currency)}{" "}
                <span className="font-normal text-white/80">/ year</span>
              </>
            ) : (
              "Free"
            )}
          </p>
        </div>
      </div>

      {/* Give → receive → join (MESITA-590). No hero — the matrix IS the
          pitch, Welcome-first, capped, super simple. */}
      <div className="flex w-full flex-1 flex-col gap-3 p-3.5">
        <div className="flex flex-col gap-1.5">
          <ModalLabel>You give</ModalLabel>
          {paid ? (
            <>
              <p className="text-muted-foreground text-[11px] leading-snug">
                These discounts, capped at{" "}
                {formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} per
                bill:
              </p>
              <RateMatrix rates={r} />
            </>
          ) : (
            <p className="text-muted-foreground text-[12px] leading-snug">
              Nothing — Zero is free. No discounts.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <ModalLabel>You receive</ModalLabel>
          <PlacementReward strategy={strategy} art={art} />
        </div>

        {/* Presentational CTA — the whole card is the button; the modal
            carries the real action. */}
        <div className="mt-auto pt-1">
          {selected ? (
            <span className="border-border text-muted-foreground inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full border text-[12px] font-bold">
              <Check className="h-3.5 w-3.5" />
              Current
            </span>
          ) : paid ? (
            <span
              className={cx(
                "inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r text-[12px] font-bold text-white",
                art.cta,
              )}
            >
              {member ? "Switch" : "Join"}
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

// ─── Product modal — full detail + the action ───────────────────────────────

function ProductModal({
  strategy,
  currency,
  isCurrent,
  member,
  onConfirm,
  onClose }: {
  strategy: Strategy;
  currency: string | null;
  isCurrent: boolean;
  member: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;
  const r = strategy.rates;

  const primaryLabel = isCurrent
    ? "Current strategy"
    : paid
      ? member
        ? `Switch to ${strategy.name}`
        : `Join — ${formatMoney(MEMBERSHIP_PRICE_MXN, currency)}/year`
      : "Drop to Zero";

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
        <div
          className={cx(
            "relative h-32 shrink-0 bg-gradient-to-br",
            art.fallback,
          )}
        >
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
                  {formatMoney(MEMBERSHIP_PRICE_MXN, currency)}{" "}
                  <span className="font-normal text-white/80">/ year</span>
                </>
              ) : (
                "Free"
              )}
            </p>
          </div>
        </div>

        {/* Detail */}
        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          <p className="text-muted-foreground text-[13px] leading-snug">
            {strategy.tagline}
          </p>

          <div className="flex flex-col gap-2">
            <ModalLabel>You give</ModalLabel>
            {paid ? (
              <>
                <RateMatrix rates={r} />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Every discount applies to the first{" "}
                  {formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} of
                  the bill — a platform-wide cap, always shown to guests.
                </p>
              </>
            ) : (
              <p className="text-muted-foreground text-[12px] leading-snug">
                Nothing — Zero is free. No discounts.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <ModalLabel>You receive</ModalLabel>
            <PlacementReward strategy={strategy} art={art} />
          </div>

          {paid ? (
            <div className="flex flex-col gap-3">
              <ModalLabel>How it works</ModalLabel>
              <Step n={1} title="Pay the membership">
                {formatMoney(MEMBERSHIP_PRICE_MXN, currency)}/year — one strategy
                at a time; switching later is a new membership.
              </Step>
              <Step n={2} title="Set up your staff on WhatsApp">
                We send a test ping so your team can receive guest tickets.
              </Step>
              <Step n={3} title="Redeem your first guest reward">
                Honor the first ticket at the bill and you&apos;re live.
              </Step>
              <p className="text-muted-foreground text-[10px] leading-snug">
                Turn a guest away and it&apos;s a strike — 1 warning · 2
                discounts paused 30 days · 3 removed. Strikes decay after 6
                months clean.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <ModalLabel>How it works</ModalLabel>
              <p className="text-muted-foreground text-[12px] leading-snug">
                No membership, nothing to set up — Zero is free and you stay
                listed on Mesita. Join a strategy any time.
              </p>
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="border-border flex flex-col gap-2 border-t p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold">
              {paid ? (
                <>
                  {formatMoney(MEMBERSHIP_PRICE_MXN, currency)}
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
              onClick={onConfirm}
              className={cx(
                "inline-flex h-11 items-center justify-center rounded-full px-5 text-[13px] font-bold transition",
                isCurrent
                  ? "border-border text-muted-foreground border"
                  : paid
                    ? cx(
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
            Admin write — sets plan + rates directly, no Stripe charge from
            here.
          </p>
        </div>
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

// One numbered step in the modal's "How it works" flow.
function Step({
  n,
  title,
  children }: {
  n: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="bg-foreground text-background mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums">
        {n}
      </span>
      <div className="flex flex-col">
        <p className="text-foreground/90 text-[13px] leading-snug font-semibold">
          {title}
        </p>
        {children && (
          <p className="text-muted-foreground text-[11px] leading-snug">
            {children}
          </p>
        )}
      </div>
    </div>
  );
}

// The 2×2 discount matrix — Welcome/Returning × Standard/Premium. Pato-sanctioned
// per-card matrix (MESITA-590); rates live in HTML text, never in the artwork.
function RateMatrix({ rates }: { rates: Strategy["rates"] }) {
  const cell = (v: number | null) => (v == null ? "—" : `${v}%`);
  return (
    <div className="border-border/60 grid grid-cols-[auto_1fr_1fr] overflow-hidden rounded-lg border text-[11px]">
      <span className="bg-muted/40 px-2.5 py-1.5" aria-hidden />
      <span className="text-muted-foreground bg-muted/40 px-2.5 py-1.5 text-center font-semibold">
        Standard
      </span>
      <span className="bg-violet-500/10 px-2.5 py-1.5 text-center font-semibold text-violet-600">
        Premium
      </span>

      <span className="text-muted-foreground border-border/60 border-t px-2.5 py-1.5 font-medium">
        Welcome
      </span>
      <span className="text-foreground/80 border-border/60 border-t px-2.5 py-1.5 text-center font-bold tabular-nums">
        {cell(rates.welcome_free_rate)}
      </span>
      <span className="border-border/60 border-t bg-violet-500/[0.06] px-2.5 py-1.5 text-center font-bold tabular-nums text-violet-600">
        {cell(rates.welcome_premium_rate)}
      </span>

      <span className="text-muted-foreground border-border/60 border-t px-2.5 py-1.5 font-medium">
        Returning
      </span>
      <span className="text-foreground/80 border-border/60 border-t px-2.5 py-1.5 text-center font-bold tabular-nums">
        {cell(rates.free_rate)}
      </span>
      <span className="border-border/60 border-t bg-violet-500/[0.06] px-2.5 py-1.5 text-center font-bold tabular-nums text-violet-600">
        {cell(rates.premium_rate)}
      </span>
    </div>
  );
}

// The "You receive" reward — the payoff, made the card's second visual anchor
// (MESITA-592): the placement level big in the strategy's own accent + a
// filled ladder, so what the membership BUYS reads louder than the mechanics.
function PlacementReward({
  strategy,
  art }: {
  strategy: Strategy;
  art: (typeof CARD_ART)[StrategyId];
}) {
  const idx = STRATEGY_VISIBILITY_LADDER.indexOf(strategy.visibility);
  return (
    <div
      className={cx(
        "flex flex-col gap-2 rounded-xl border p-3",
        art.recvBg,
        art.recvBorder,
      )}
    >
      <div className="flex items-center gap-2">
        <TrendingUp className={cx("h-4 w-4 shrink-0", art.recvText)} />
        <span
          className={cx(
            "font-display text-xl leading-none font-bold tracking-tight",
            art.recvText,
          )}
        >
          {strategy.visibility}
        </span>
        <span className="text-muted-foreground text-[11px] leading-tight">
          algorithm
          <br />
          placement
        </span>
      </div>
      <div className="flex gap-1" aria-hidden>
        {STRATEGY_VISIBILITY_LADDER.map((lvl, i) => (
          <span
            key={lvl}
            className={cx(
              "h-1.5 flex-1 rounded-full",
              i <= idx ? art.meter : "bg-muted",
            )}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Box 2 · FAQs — how the membership works, with real numbers ─────────────

function FaqsBox({
  place,
  storedStrategy }: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
}) {
  const currency = place.currency;
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, currency);
  const cap = formatMoney(UNIVERSAL_CAP_MXN, currency);
  // 50% off, the FAQ's worked example rate — applied to the capped portion.
  const exampleSavesMxn = UNIVERSAL_CAP_MXN * 0.5;

  return (
    <SectionCard
      icon={<CircleHelp className="h-4 w-4" />}
      tint="sky"
      title="FAQs"
      subtitle="How the Mesita Membership works — with real numbers."
    >
      <div className="mt-4 flex flex-col gap-2">
        <Faq q="What does a Premium guest actually get?" defaultOpen>
          <PremiumExamples place={place} storedStrategy={storedStrategy} />
        </Faq>

        <Faq q="Why do all four memberships cost the same?">
          <p>
            Because rank is never for sale. The {price}/year is identical on
            Conservative, Aggressive and Dominant — what you buy is a
            commitment to give, not placement. The only thing that changes
            between strategies is the discount schedule you promise your guests,
            and the visibility that generosity earns back.
          </p>
        </Faq>

        <Faq q={`What exactly does the ${price}/year buy?`}>
          <p>
            It is a commitment filter, not a feature tier — it keeps
            half-hearted restaurants out of the rewards program and guests
            away from dead coupons. Being a member unlocks the paid strategies
            and turns on your discounts. Being listed on Mesita never costs
            anything, member or not.
          </p>
        </Faq>

        <Faq q="How does visibility work?">
          <p>
            The ranking algorithm reads a stronger discount as a stronger
            card: Zero sits at Low, Conservative at Mid, Aggressive at High
            and Dominant at Max. Visibility is never a separate knob you can
            buy — it rises with what you give.
          </p>
        </Faq>

        <Faq q={`What is the ${cap} cap?`}>
          <p>
            Every discount applies only to the first {cap} of the bill — a
            platform-wide constant, always shown to guests. Example: 50% off
            a {formatMoney(EXAMPLE_BILL_MXN, currency)} bill touches the first{" "}
            {cap}, so the guest saves{" "}
            {formatMoney(exampleSavesMxn, currency)} and pays{" "}
            {formatMoney(EXAMPLE_BILL_MXN - exampleSavesMxn, currency)}
            . The headline stays big; the cost stays bounded.
          </p>
        </Faq>

        <Faq q="How does a place activate?">
          <p>
            Two steps: the staff WhatsApp channel passes a test ping, and the
            first guest ticket is honored at the bill. Mesita runs both — no
            self-serve switch.
          </p>
        </Faq>

        <Faq q="Can a place switch strategies or cancel?">
          <p>
            Switching strategies is a NEW {price}/year membership — that is the
            lock-in: places pick a strategy and live it. Dropping to Zero is
            free and instant; it clears the rates and paid promos stop, but
            the place stays listed on Mesita.
          </p>
        </Faq>

        <Faq q="What happens if a guest is turned away?">
          <p>
            A refused or ignored QR is a strike: 1 — warning and the
            activation test re-runs · 2 — your discounts pause for 30 days ·
            3 — removed from the paid strategies and the fee is forfeited (the
            place stays listed on Mesita). Strikes decay after 6 months clean,
            and the turned-away guest is compensated instantly.
          </p>
        </Faq>
      </div>
    </SectionCard>
  );
}

// Native details/summary accordion item — no state, keyboard-accessible.
function Faq({
  q,
  defaultOpen,
  children }: {
  q: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="border-border/60 group rounded-xl border"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0 transition group-open:rotate-180" />
      </summary>
      <div className="text-muted-foreground flex flex-col gap-2.5 px-3.5 pb-3.5 text-[12px] leading-relaxed">
        {children}
      </div>
    </details>
  );
}

// The Premium-guest worked examples (FAQ #1) — computed from the place's LIVE
// rate columns, so custom or legacy rates preview exactly what the bill EF
// would apply today.
function PremiumExamples({
  place,
  storedStrategy }: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
}) {
  const hasPromo =
    place.welcome_premium_rate != null || place.premium_rate != null;
  const strategy = storedStrategy ? STRATEGY_BY_ID[storedStrategy] : null;
  const cap = place.monthly_promo_cap ?? UNIVERSAL_CAP_MXN;

  if (!hasPromo) {
    return (
      <div className="border-border/60 bg-muted/20 rounded-xl border border-dashed px-4 py-4 text-center">
        <p className="text-muted-foreground text-[12px] leading-snug">
          No promos right now — Premium guests see this place in the catalog
          with no discount card. Join a strategy above to preview the deal.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-foreground/80">
          The current rates worked on a sample{" "}
          {formatMoney(EXAMPLE_BILL_MXN, place.currency)} ticket:
        </p>
        <span className="bg-muted text-foreground/70 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          {strategy && strategy.id !== ZERO_STRATEGY_ID
            ? `${strategy.emoji} ${strategy.name}`
            : "Custom rates"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ExampleCard
          visit="Welcome"
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
      <p>
        Premium ≥ Standard in every strategy — Premium guests always get the
        better deal. They are what the membership buys.
      </p>
    </>
  );
}

function ExampleCard({
  visit,
  premiumRate,
  freeRate,
  cap,
  currency }: {
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
              ? "A Standard guest gets no discount on this visit."
              : `A Standard guest saves ${formatMoney(freeSaves, currency)} (${freeRate}%).`}
          </p>
        </>
      )}
    </div>
  );
}

// ─── Shared bits ────────────────────────────────────────────────────────────

function StatusPill({ member }: { member: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        member
          ? "bg-emerald-500/12 text-emerald-700"
          : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          member ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {member ? "Member" : "Free"}
    </span>
  );
}
