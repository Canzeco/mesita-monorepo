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
  Percent,
  QrCode,
  ShieldCheck,
  Ticket,
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
import { getRewardsConfig } from "@/app/(app)/rewards-config/actions";
import {
  ACTION_KEYS,
  ACTION_META,
  CLASS_KEYS,
  CLASS_META,
  DEFAULT_CONFIG,
  rateFromRules,
  type ActionKey,
  type ClassKey,
  type RewardsConfig } from "@/app/(app)/rewards-config/catalog";
import {
  setPlacePlan,
  setPlaceStrategy,
  type AdminPlace,
} from "../actions";
import {SectionCard} from "../ui";
import { ErrorNote } from "@/components/ErrorNote";

// Admin Promos — three boxes (MESITA-912 membership unbundle):
//   1. Membership — MX$1,000/year fee, status pill, join/drop, activation,
//      strikes. Admin writes plan directly — no Stripe charge from here.
//   2. Strategy — four cards (give/receive, no price). Non-members: cards
//      locked, tap routes to join with that strategy preselected. Members:
//      switch = rates-only write (setPlaceStrategy).
//   3. FAQs — how the model works, Premium worked example under CURRENT
//      strategy.

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

// A place on any paid plan carries a membership (plan != free).
function isMember(place: AdminPlace): boolean {
  return !!place.plan && place.plan !== "free";
}

type MembershipPillState =
  | "not_member"
  | "pending"
  | "live"
  | "paused"
  | "forfeited";

function membershipPillState(place: AdminPlace): MembershipPillState {
  if (place.membership_forfeited_at) return "forfeited";
  if (!isMember(place)) return "not_member";
  if (
    place.promo_paused_until &&
    new Date(String(place.promo_paused_until)).getTime() > Date.now()
  ) {
    return "paused";
  }
  if (place.membership_live_at) return "live";
  return "pending";
}

function strategyRates(s: Strategy) {
  return {
    welcome_free_rate: s.rates.welcome_free_rate,
    welcome_premium_rate: s.rates.welcome_premium_rate,
    free_rate: s.rates.free_rate,
    premium_rate: s.rates.premium_rate,
    monthly_promo_cap: s.cap,
  };
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
  // The v7 matrix, read LIVE from rewards_config (rates are never cached in
  // code — MESITA-859). Identity defaults render until the fetch lands, so
  // the cards never flash empty; on failure they simply keep the defaults.
  const [matrix, setMatrix] = useState<RewardsConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getRewardsConfig();
      if (active && r.ok) setMatrix(r.config);
    })();
    return () => {
      active = false;
    };
  }, []);

  const member = isMember(v);
  const pillState = membershipPillState(v);
  const storedStrategy = strategyForPlace(v);
  const forfeited = pillState === "forfeited";

  const applyPlace = (next: AdminPlace) => {
    setV(next);
    onSaved(next);
  };

  const revertPlace = (prev: AdminPlace) => {
    setV(prev);
    onSaved(prev);
  };

  const commitJoin = (target: StrategyId) => {
    setModalId(null);
    if (pending || member) return;
    const s = STRATEGY_BY_ID[target];
    const rates = strategyRates(s);
    const plan = planForSubscription("pro_discount");

    const prev = v;
    const optimistic: AdminPlace = { ...v, ...rates, plan };
    applyPlace(optimistic);
    setError(null);

    start(async () => {
      const r = await setPlacePlan(prev.id, plan, rates);
      if (!r.ok) {
        revertPlace(prev);
        setError(r.error);
        return;
      }
      applyPlace(r.data);
    });
  };

  const commitDrop = () => {
    if (pending || !member) return;
    const zero = STRATEGY_BY_ID[ZERO_STRATEGY_ID];
    const rates = strategyRates(zero);
    const plan = planForSubscription("free");

    const prev = v;
    const optimistic: AdminPlace = { ...v, ...rates, plan };
    applyPlace(optimistic);
    setError(null);

    start(async () => {
      const r = await setPlacePlan(prev.id, plan, rates);
      if (!r.ok) {
        revertPlace(prev);
        setError(r.error);
        return;
      }
      applyPlace(r.data);
    });
  };

  const commitSwitch = (target: StrategyId) => {
    setModalId(null);
    if (pending || !member || target === storedStrategy) return;
    const s = STRATEGY_BY_ID[target];
    const rates = strategyRates(s);

    const prev = v;
    const optimistic: AdminPlace = { ...v, ...rates };
    applyPlace(optimistic);
    setError(null);

    start(async () => {
      const r = await setPlaceStrategy(prev.id, rates);
      if (!r.ok) {
        revertPlace(prev);
        setError(r.error);
        return;
      }
      applyPlace(r.data);
    });
  };

  const onCardOpen = (id: StrategyId) => {
    if (!member) {
      setModalId(id);
      return;
    }
    if (id === storedStrategy) {
      setModalId(id);
      return;
    }
    setModalId(id);
  };

  const onModalConfirm = (target: StrategyId) => {
    if (!member) {
      commitJoin(target);
      return;
    }
    commitSwitch(target);
  };

  const modalStrategy = modalId ? STRATEGY_BY_ID[modalId] : null;

  return (
    <div className="flex flex-col gap-5">
      {/* ── Box 1 · Membership ─────────────────────────────────────────── */}
      <MembershipBox
        place={v}
        pillState={pillState}
        pending={pending}
        onDrop={commitDrop}
      />

      {/* ── Box 2 · Strategy ───────────────────────────────────────────── */}
      <SectionCard
        icon={<TrendingUp className="h-4 w-4" />}
        tint="violet"
        title="Strategy"
        subtitle="Four discount postures — switch free anytime while membership is active."
        action={
          pending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : undefined
        }
      >
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {STRATEGIES.map((s) => (
            <StrategyCard
              key={s.id}
              strategy={s}
              matrix={matrix}
              currency={v.currency}
              selected={s.id === storedStrategy}
              member={member}
              locked={!member && !forfeited}
              pending={pending && s.id === storedStrategy}
              onOpen={() => onCardOpen(s.id)}
            />
          ))}
        </div>

        {storedStrategy === null && member && (
          <p className="text-muted-foreground mt-2.5 text-[11px]">
            Current rates don&apos;t match a strategy — pick one to standardize.
          </p>
        )}

        {!member && !forfeited && (
          <p className="text-muted-foreground mt-3 text-[11px] leading-snug">
            Join membership first — tap any strategy to start with that posture.
          </p>
        )}

        {error && (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        )}
      </SectionCard>

      {/* ── Box 3 · FAQs ───────────────────────────────────────────────── */}
      <FaqsBox place={v} storedStrategy={storedStrategy} member={member} />

      {modalStrategy && (
        <ProductModal
          strategy={modalStrategy}
          matrix={matrix}
          currency={v.currency}
          isCurrent={modalStrategy.id === storedStrategy}
          member={member}
          onConfirm={() => onModalConfirm(modalStrategy.id)}
          onClose={() => setModalId(null)}
        />
      )}
    </div>
  );
}

// ─── Membership box ────────────────────────────────────────────────────────

const STRIKES: { n: string; consequence: string }[] = [
  { n: "1", consequence: "A warning — your discounts keep running." },
  { n: "2", consequence: "Your discounts are paused for 30 days." },
  {
    n: "3",
    consequence:
      "Membership forfeited — promos off, place stays listed on Mesita.",
  },
];

function MembershipBox({
  place,
  pillState,
  pending,
  onDrop,
}: {
  place: AdminPlace;
  pillState: MembershipPillState;
  pending: boolean;
  onDrop: () => void;
}) {
  const statusNote = describeMembershipStatus(place, pillState);

  return (
    <SectionCard
      icon={<Percent className="h-4 w-4" />}
      tint="pink"
      title="Mesita Membership"
      subtitle="One annual fee — the commitment filter. Strategy switching is free."
      action={<MembershipStatusPill state={pillState} />}
    >
      <div className="mt-4 flex flex-col gap-4">
        {statusNote && (
          <p
            className={cx(
              "rounded-xl p-3 text-[12px] leading-snug",
              statusNote.tone === "live" && "bg-emerald-500/10 text-emerald-800",
              statusNote.tone === "warn" && "bg-amber-500/10 text-amber-900",
              statusNote.tone === "blocked" &&
                "bg-destructive/10 text-destructive",
            )}
          >
            {statusNote.label}
          </p>
        )}

        <div className="border-border bg-muted/25 flex items-start gap-3 rounded-xl border p-3">
          <ShieldCheck className="text-primary mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-semibold">
              {formatMoney(MEMBERSHIP_PRICE_MXN, place.currency)}{" "}
              <span className="text-muted-foreground text-[11px] font-normal">
                / year
              </span>
            </p>
            <p className="text-muted-foreground text-[11px] leading-snug">
              A commitment filter, not a feature tier — it keeps half-hearted
              restaurants out of the rewards program. Rank is never for sale;
              strategy switching is free once you&apos;re a member.
            </p>
          </div>
        </div>

        {pillState !== "not_member" && pillState !== "forfeited" && (
          <button
            type="button"
            disabled={pending}
            onClick={onDrop}
            className="border-border text-foreground/75 hover:bg-muted inline-flex h-10 items-center justify-center self-start rounded-full border px-4 text-[12px] font-bold transition disabled:opacity-60"
          >
            Drop membership
          </button>
        )}

        <MembershipSubHeading icon={Ticket}>Activation</MembershipSubHeading>
        <div className="flex flex-col gap-1.5">
          <MembershipActivationStep icon={QrCode}>
            Staff scan a guest&apos;s QR on Mesita Check — no app, no account.
          </MembershipActivationStep>
          <MembershipActivationStep icon={Ticket}>
            The first guest ticket is honored at the bill — then you&apos;re
            live.
          </MembershipActivationStep>
        </div>

        <MembershipSubHeading icon={AlertTriangle}>
          If a guest is turned away
        </MembershipSubHeading>
        <div className="border-border overflow-hidden rounded-xl border">
          {STRIKES.map((s, i) => (
            <div
              key={s.n}
              className={cx(
                "flex items-center gap-3 px-3 py-2.5",
                i > 0 && "border-border border-t",
              )}
            >
              <span
                className={cx(
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
          Admin writes plan directly — no Stripe charge from here. Strikes decay
          after 6 months clean.
        </p>
      </div>
    </SectionCard>
  );
}

function describeMembershipStatus(
  place: AdminPlace,
  pillState: MembershipPillState,
): { label: string; tone: "live" | "warn" | "blocked" } | null {
  if (pillState === "forfeited") {
    return {
      label:
        "Membership forfeited after 3 strikes — re-join is an admin decision.",
      tone: "blocked",
    };
  }
  if (pillState === "not_member") return null;
  if (pillState === "paused") {
    return {
      label: `Promo lane paused until ${String(place.promo_paused_until).slice(0, 10)} (strike 2).`,
      tone: "blocked",
    };
  }
  if (pillState === "live") {
    const strikes = (place.strike_count as number | null) ?? 0;
    return {
      label:
        strikes > 0
          ? `Membership live · ${strikes} active strike${strikes === 1 ? "" : "s"}.`
          : "Membership live — promo lane open.",
      tone: strikes > 0 ? "warn" : "live",
    };
  }
  return {
    label:
      "Member — pending activation. Honor the first guest check to go live.",
    tone: "warn",
  };
}

function MembershipSubHeading({
  icon: Icon,
  children,
}: {
  icon: typeof Ticket;
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

function MembershipActivationStep({
  icon: Icon,
  children,
}: {
  icon: typeof Ticket;
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

// ─── Strategy card — give/receive only; price lives in Membership box ──────

function StrategyCard({
  strategy,
  matrix,
  currency,
  selected,
  member,
  locked,
  pending,
  onOpen }: {
  strategy: Strategy;
  matrix: RewardsConfig;
  currency: string | null;
  selected: boolean;
  member: boolean;
  locked: boolean;
  pending: boolean;
  onOpen: () => void;
}) {
  const art = CARD_ART[strategy.id];
  const paid = strategy.id !== ZERO_STRATEGY_ID;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      aria-label={`${strategy.name} — details${selected ? " (current)" : ""}${locked ? " (locked)" : ""}`}
      className={cx(
        "bg-card relative flex flex-col overflow-hidden rounded-2xl border text-left transition",
        selected
          ? "border-foreground/70 ring-foreground/70 ring-2"
          : "border-border/60 motion-safe:hover:-translate-y-0.5 hover:shadow-[0_18px_32px_-20px_rgba(0,0,0,0.35)]",
        locked && !selected && "opacity-75",
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
          sizes="(min-width:640px) 50vw, 100vw"
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
              <RewardsMatrix matrix={matrix} strategy={strategy.id} />
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
          ) : locked ? (
            <span
              className={cx(
                "inline-flex h-11 w-full items-center justify-center rounded-full bg-gradient-to-r text-[12px] font-bold text-white",
                paid ? art.cta : "border-border text-foreground/75 border bg-transparent",
              )}
            >
              Join
            </span>
          ) : member ? (
            <span
              className={cx(
                "inline-flex h-11 w-full items-center justify-center rounded-full text-[12px] font-bold",
                paid
                  ? cx("bg-gradient-to-r text-white", art.cta)
                  : "border-border text-foreground/75 border",
              )}
            >
              {paid ? "Switch" : "Switch to Zero"}
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

// ─── Product modal — full detail + the action ───────────────────────────────

function ProductModal({
  strategy,
  matrix,
  currency,
  isCurrent,
  member,
  onConfirm,
  onClose }: {
  strategy: Strategy;
  matrix: RewardsConfig;
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
  const isZeroSwitch = member && strategy.id === ZERO_STRATEGY_ID;

  const primaryLabel = isCurrent
    ? "Current strategy"
    : !member
      ? `Join — ${formatMoney(MEMBERSHIP_PRICE_MXN, currency)}/year`
      : paid
        ? `Switch to ${strategy.name}`
        : "Switch to Zero";

  const footerNote = isCurrent
    ? ""
    : !member
      ? `Starts membership at ${formatMoney(MEMBERSHIP_PRICE_MXN, currency)}/year with ${strategy.name} rates. Admin write — no Stripe charge.`
      : isZeroSwitch
        ? "Membership stays active; discounts pause. Promo lane closes until you pick a paid strategy again."
        : "Applies to new tickets only — open tickets keep the rates they were created with.";

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
                <RewardsMatrix matrix={matrix} strategy={strategy.id} />
                <p className="text-muted-foreground text-[11px] leading-snug">
                  Every discount applies to the first{" "}
                  {formatMoney(strategy.cap ?? UNIVERSAL_CAP_MXN, currency)} of
                  the bill — a platform-wide cap, always shown to guests. A
                  guest gets their single best qualifying rate, never a sum.
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
              <Step n={1} title="Join the membership">
                {formatMoney(MEMBERSHIP_PRICE_MXN, currency)}/year — one fee,
                switch strategies free anytime.
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
                {member
                  ? "Zero pauses discounts — membership stays active. Drop membership separately if you want to leave."
                  : "Non-members stay at Zero — no discounts. Join membership to unlock the paid strategies."}
              </p>
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="border-border flex flex-col gap-2 border-t p-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              disabled={isCurrent}
              onClick={onConfirm}
              className={cx(
                "inline-flex h-11 items-center justify-center rounded-full px-5 text-[13px] font-bold transition",
                isCurrent
                  ? "border-border text-muted-foreground border"
                  : !member || paid
                    ? cx(
                        "bg-gradient-to-r text-white hover:brightness-105 active:scale-[0.99]",
                        art.cta || "from-slate-600 to-slate-500",
                      )
                    : "border-border text-foreground hover:bg-muted border",
              )}
            >
              {isCurrent && <Check className="mr-1.5 h-3.5 w-3.5" />}
              {primaryLabel}
            </button>
          </div>
          {footerNote && (
            <p className="text-muted-foreground text-[10px] leading-snug">
              {footerNote}
            </p>
          )}
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

// The v7 Strategy × Class matrix at this strategy (MESITA-862, replaces the
// retired 2×2): rows = guest classes, columns = None (standing) + the four
// rewarded actions, read live from rewards_config. Story is universal
// (MESITA-909) — every class row shows its priced cell; eligibility is
// Instagram-connected at the consumer EF layer. Rates live in HTML text,
// never artwork.
function RewardsMatrix({
  matrix,
  strategy }: {
  matrix: RewardsConfig;
  strategy: StrategyId;
}) {
  const cell = (v: number) => (v > 0 ? `${v}%` : "—");
  const shortClass: Record<ClassKey, string> = {
    standard: "Standard",
    premium: "Premium",
    influencer: "Influencer",
    aura: "Aura" };
  // Zero has no rules — it is off by definition, and this card is only shown
  // for the paid strategies anyway.
  const paidStrategy = strategy === "zero" ? null : strategy;
  const shortAction: Record<ActionKey, string> = {
    standing: "None",
    mesita_review: ACTION_META.mesita_review.emoji,
    story: ACTION_META.story.emoji,
    welcome: ACTION_META.welcome.emoji,
    review: ACTION_META.review.emoji };
  return (
    <div className="flex flex-col gap-1">
      <div className="border-border/60 grid grid-cols-[minmax(0,1.4fr)_repeat(5,minmax(0,1fr))] overflow-hidden rounded-lg border text-[10.5px]">
        <span className="bg-muted/40 px-2 py-1.5" aria-hidden />
        {ACTION_KEYS.map((a) => (
          <span
            key={a}
            title={ACTION_META[a].name}
            className="text-muted-foreground bg-muted/40 px-1 py-1.5 text-center font-semibold"
          >
            {shortAction[a]}
          </span>
        ))}
        {CLASS_KEYS.map((cls) => (
          <div key={cls} className="contents">
            <span
              className="text-muted-foreground border-border/60 truncate border-t px-2 py-1.5 font-medium"
              title={CLASS_META[cls].name}
            >
              {CLASS_META[cls].emoji} {shortClass[cls]}
            </span>
            {ACTION_KEYS.map((a) => (
              <span
                key={a}
                className="text-foreground/80 border-border/60 border-t px-1 py-1.5 text-center font-bold tabular-nums"
              >
                {!paidStrategy
                  ? "—"
                  : cell(rateFromRules(matrix.rules, paidStrategy, cls, a))}
              </span>
            ))}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground/80 text-[10px] leading-snug">
        {ACTION_KEYS.map(
          (a, i) =>
            `${i > 0 ? " · " : ""}${ACTION_META[a].emoji} ${ACTION_META[a].name}`,
        ).join("")}{" "}
        · best rate wins
      </p>
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
  storedStrategy,
  member }: {
  place: AdminPlace;
  storedStrategy: StrategyId | null;
  member: boolean;
}) {
  const currency = place.currency;
  const price = formatMoney(MEMBERSHIP_PRICE_MXN, currency);
  const cap = formatMoney(UNIVERSAL_CAP_MXN, currency);
  const exampleSavesMxn = UNIVERSAL_CAP_MXN * 0.5;

  return (
    <SectionCard
      icon={<CircleHelp className="h-4 w-4" />}
      tint="sky"
      title="FAQs"
      subtitle="How membership and strategy work — with real numbers."
    >
      <div className="mt-4 flex flex-col gap-2">
        <Faq q="What does a Premium guest actually get?" defaultOpen>
          <PremiumExamples place={place} storedStrategy={storedStrategy} />
        </Faq>

        <Faq q={`What exactly does the ${price}/year buy?`}>
          <p>
            One Mesita Membership — a commitment filter, not a feature tier. It
            keeps half-hearted restaurants out of the rewards program and guests
            away from dead coupons. Being a member unlocks the paid strategies
            and turns on your discounts. Being listed on Mesita never costs
            anything, member or not.
          </p>
        </Faq>

        <Faq q="Can I switch strategies?">
          <p>
            Yes — free, anytime, while your membership is active. Strategy is
            the discount posture you promise guests; switching only changes
            your rates. New tickets pick up the new rates; open tickets keep
            what they were created with.
          </p>
        </Faq>

        <Faq q="What is Zero for members?">
          <p>
            Zero pauses discounts — your membership stays active, activation
            state and strikes carry on, but the promo lane closes and visibility
            drops to Low. Cancelling membership is a separate action in the
            Membership box.
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

        <Faq q="How do I cancel membership?">
          <p>
            Use Drop membership in the Membership box — it clears your plan
            and rates. {member ? "You are currently a member." : "You are not currently a member."}
          </p>
        </Faq>

        <Faq q="What happens if a guest is turned away?">
          <p>
            A refused or ignored QR is a strike: 1 — warning and the
            activation test re-runs · 2 — your discounts pause for 30 days ·
            3 — membership forfeited (the place stays listed on Mesita). Strikes
            decay after 6 months clean, and the turned-away guest is compensated
            instantly.
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
          with no discount card. Pick a strategy above to preview the deal.
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

function MembershipStatusPill({ state }: { state: MembershipPillState }) {
  const labels: Record<MembershipPillState, string> = {
    not_member: "Not a member",
    pending: "Member — pending",
    live: "Member — live",
    paused: "Paused",
    forfeited: "Forfeited",
  };
  const liveish = state === "live" || state === "pending";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase",
        state === "forfeited" && "bg-destructive/10 text-destructive",
        state === "paused" && "bg-amber-500/12 text-amber-800",
        liveish && "bg-emerald-500/12 text-emerald-700",
        state === "not_member" && "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          state === "forfeited" && "bg-destructive",
          state === "paused" && "bg-amber-500",
          liveish && "bg-emerald-500",
          state === "not_member" && "bg-muted-foreground/50",
        )}
      />
      {labels[state]}
    </span>
  );
}
