"use client";

import { useEffect, useState, useTransition } from "react";
import Image from "next/image";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  CircleHelp,
  Crown,
  Loader2,
  MessageCircle,
  Percent,
  ShieldCheck,
  X,
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
import { SectionCard, ErrorNote } from "../ui";

// Admin Promos — Mesita Membership (MESITA-585).
//   1. Mesita Membership — FOUR simplified pricing cards (art band, up-to-N%
//      hero, four segment rows, CTA — the meter and cap microcopy moved off
//      the card face). The whole card opens the product modal (full detail +
//      the action). Three paid postures cost the SAME MX$1,000/year;
//      switching is a NEW membership (the lock-in). One tap in the modal
//      writes rates + cap + paying plan flags atomically.
//   2. FAQs — how the membership works, with real numbers: the Premium-guest
//      worked examples live in the first (default-open) item.

const MEMBERSHIP_PRICE_MXN = 1000;

// Sample ticket for the worked example — deliberately above the universal cap
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

const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");

function formatMoney(amount: number, currency: string | null): string {
  const prefix = !currency || currency === "MXN" ? "MX$" : "$";
  return `${prefix}${amount.toLocaleString("en-US")}`;
}

// A place on any paid posture carries a membership (plan != free).
function isMember(place: AdminPlace): boolean {
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
  const [modalId, setModalId] = useState<StrategyId | null>(null);

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

  const member = isMember(v);
  const storedStrategy = strategyForPlace(v);

  // The modal is the confirm step: its footer action commits the posture.
  const commitStrategy = (target: StrategyId) => {
    setModalId(null);
    if (pending || target === storedStrategy) return;
    const s = STRATEGY_BY_ID[target];
    // Rates + cap + paying flags in ONE write: the membership IS the rates.
    persist({
      ...dbStateForSubscription(target === "zero" ? "free" : "pro_discount"),
      welcome_free_rate: s.rates.welcome_free_rate,
      welcome_premium_rate: s.rates.welcome_premium_rate,
      free_rate: s.rates.free_rate,
      premium_rate: s.rates.premium_rate,
      monthly_promo_cap: s.cap,
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
        subtitle={`Four postures, one price for the paid three — ${formatMoney(MEMBERSHIP_PRICE_MXN, v.currency)}/year each. Tap a card for the full detail.`}
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
            Current rates don&apos;t match a posture — pick one to standardize.
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
  onOpen,
}: {
  strategy: Strategy;
  currency: string | null;
  selected: boolean;
  member: boolean;
  pending: boolean;
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

      {/* Simplified body: hero + the four segment rows + CTA. */}
      <div className="flex w-full flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-center justify-between gap-2">
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
          <span className="bg-muted/70 text-foreground/70 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide">
            {strategy.visibility} visibility
          </span>
        </div>

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
  onClose,
}: {
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
  const paid = strategy.id !== "zero";
  const r = strategy.rates;

  const primaryLabel = isCurrent
    ? "Current posture"
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
                {formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} of
                the bill — a platform-wide cap, always shown to guests.
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
                ? `A stronger discount earns more visibility on Mesita — this posture reads as ${strategy.visibility}.`
                : "You stay listed on Mesita. Without discounts, visibility stays Low."}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <ModalLabel>The commitment</ModalLabel>
            {paid ? (
              <div className="flex flex-col gap-1.5">
                <CommitmentRow icon={ShieldCheck}>
                  {formatMoney(MEMBERSHIP_PRICE_MXN, currency)}/year, per
                  posture — switching later is a NEW membership. Same price on
                  every posture: rank is never for sale.
                </CommitmentRow>
                <CommitmentRow icon={MessageCircle}>
                  Activation: your staff WhatsApp passes a test ping and the
                  first guest ticket is honored at the bill.
                </CommitmentRow>
                <CommitmentRow icon={AlertTriangle}>
                  Strikes for turning a guest away: 1 warning · 2 discounts
                  paused 30 days · 3 removed and the fee is forfeited. Strikes
                  decay after 6 months clean.
                </CommitmentRow>
              </div>
            ) : (
              <CommitmentRow icon={ShieldCheck}>
                No fee, no commitment — dropping to Zero clears the rates and
                the paying flags. You can join again any time.
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

// One discount segment: ✓ + rate when the posture grants it, ✗ + em-dash when
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

// What the algorithm gives back for the generosity above (modal only).
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
        <span className="text-[11px] leading-none font-bold">{visibility}</span>
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

// ─── Box 2 · FAQs — how the membership works, with real numbers ─────────────

function FaqsBox({
  place,
  storedStrategy,
}: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
}) {
  const currency = place.currency;
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, currency);
  const cap = formatMoney(UNIVERSAL_CAP_MXN, currency);

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

        <Faq q="Why do all three memberships cost the same?">
          <p>
            Because rank is never for sale. The {price}/year is identical on
            Conservative, Aggressive and Dominant — what you buy is a
            commitment to give, not placement. The only thing that changes
            between postures is the discount schedule you promise your guests,
            and the visibility that generosity earns back.
          </p>
        </Faq>

        <Faq q={`What exactly does the ${price}/year buy?`}>
          <p>
            It is a commitment filter, not a feature tier — it keeps
            half-hearted restaurants out of the rewards program and guests
            away from dead coupons. Being a member unlocks the paid postures
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
            {formatMoney(UNIVERSAL_CAP_MXN * 0.5, currency)} and pays{" "}
            {formatMoney(EXAMPLE_BILL_MXN - UNIVERSAL_CAP_MXN * 0.5, currency)}
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

        <Faq q="Can a place switch postures or cancel?">
          <p>
            Switching postures is a NEW {price}/year membership — that is the
            lock-in: places pick a posture and live it. Dropping to Zero is
            free and instant; it clears the rates and paid promos stop, but
            the place stays listed on Mesita.
          </p>
        </Faq>

        <Faq q="What happens if a guest is turned away?">
          <p>
            A refused or ignored QR is a strike: 1 — warning and the
            activation test re-runs · 2 — your discounts pause for 30 days ·
            3 — removed from the paid postures and the fee is forfeited (the
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
  children,
}: {
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
  storedStrategy,
}: {
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
          with no discount card. Join a posture above to preview the deal.
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
          {strategy && strategy.id !== "zero"
            ? `${strategy.emoji} ${strategy.name}`
            : "Custom rates"}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
      <p>
        Premium ≥ Free in every posture — Premium guests always get the better
        deal. They are what the membership buys.
      </p>
    </>
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
