"use client";

import { Fragment, useState, useTransition } from "react";
import { Crown, Loader2, Percent } from "lucide-react";
import {
  SUBSCRIPTIONS,
  VISIBILITY_LEVELS,
  computeVisibility,
  dbStateForSubscription,
  subscriptionForPlan,
  type PlanVisibility,
  type SubscriptionId,
} from "@/lib/business/plans";
import { updatePlace, type AdminPlace } from "../actions";
import { ErrorNote, SectionCard } from "../ui";

type RateCol =
  | "welcome_free_rate"
  | "welcome_premium_rate"
  | "free_rate"
  | "premium_rate";

const RATE_CHOICES = [10, 20, 50, 70] as const;
const CAP_CHOICES = [200, 500, 1000, 2000] as const;

const RATE_ROWS: { col: RateCol; label: string; hint: string }[] = [
  { col: "welcome_free_rate", label: "Welcome · Free", hint: "First visit, Free users" },
  { col: "welcome_premium_rate", label: "Welcome · Premium", hint: "First visit, Premium users" },
  { col: "free_rate", label: "Returning · Free", hint: "Repeat visit, Free users" },
  { col: "premium_rate", label: "Returning · Premium", hint: "Repeat visit, Premium users" },
];

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
  const sub = subscriptionForPlan(v.plan);
  const isFree = sub === "free";

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

  return (
    <div className="flex flex-col gap-5">
      {/* Visibility is the product signal — plan + discounts + cap all move the needle. */}
      <VisibilityRail
        plan={v.plan}
        welcome_free_rate={v.welcome_free_rate}
        welcome_premium_rate={v.welcome_premium_rate}
        free_rate={v.free_rate}
        premium_rate={v.premium_rate}
        monthly_promo_cap={v.monthly_promo_cap}
      />

      <SectionCard
        icon={<Percent className="text-muted-foreground h-4 w-4" />}
        title="Promos"
        subtitle="Subscription plan, discount rates per user tier & visit, and the ticket cap. Discount-only — the place never holds money."
        action={pending ? <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" /> : null}
      >
        <p className="text-muted-foreground mt-5 text-[11px] font-semibold tracking-[0.12em] uppercase">
          Subscription
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {SUBSCRIPTIONS.map((s) => (
            <SubscriptionCard
              key={s.id}
              id={s.id}
              label={s.label}
              price={s.price}
              cadence={s.cadence}
              tagline={s.tagline}
              visibility={s.visibility}
              setup={s.setup}
              featured={!!s.featured}
              isCurrent={sub === s.id}
              pending={pending}
              onPick={() => persist(dbStateForSubscription(s.id))}
            />
          ))}
        </div>

        <p className="text-muted-foreground mt-7 text-[11px] font-semibold tracking-[0.12em] uppercase">
          Discount rates {isFree && <span className="normal-case">· enable a paid plan to set</span>}
        </p>
        <div className="mt-2 flex flex-col gap-2">
          {RATE_ROWS.map((row) => (
            <div
              key={row.col}
              className="border-border bg-background flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
            >
              <div>
                <p className="text-sm font-medium">{row.label}</p>
                <p className="text-muted-foreground text-xs">{row.hint}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill
                  active={v[row.col] == null}
                  disabled={isFree || pending}
                  onClick={() => persist({ [row.col]: null })}
                  tone="off"
                >
                  Off
                </Pill>
                {RATE_CHOICES.map((rate) => (
                  <Pill
                    key={rate}
                    active={v[row.col] === rate}
                    disabled={isFree || pending}
                    onClick={() => persist({ [row.col]: rate })}
                  >
                    {rate}%
                  </Pill>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="text-muted-foreground mt-7 text-[11px] font-semibold tracking-[0.12em] uppercase">
          Ticket cap {v.currency ? `(${v.currency})` : ""}
        </p>
        <div className="border-border bg-background mt-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <p className="text-muted-foreground text-xs">Max discount applied to a single ticket.</p>
          <div className="flex flex-wrap gap-1.5">
            <Pill
              active={v.monthly_promo_cap == null}
              disabled={pending}
              onClick={() => persist({ monthly_promo_cap: null })}
              tone="off"
            >
              No cap
            </Pill>
            {CAP_CHOICES.map((cap) => (
              <Pill
                key={cap}
                active={v.monthly_promo_cap === cap}
                disabled={pending}
                onClick={() => persist({ monthly_promo_cap: cap })}
              >
                {cap}
              </Pill>
            ))}
          </div>
        </div>

        {error && <ErrorNote message={error} />}
      </SectionCard>
    </div>
  );
}

// Visibility rail — six levels from plan + discount rates + ticket cap.
// Mesita shows higher-visibility places to more guests on every discovery
// surface — this is the answer the operator needs at a glance.
function VisibilityRail({
  plan,
  welcome_free_rate,
  welcome_premium_rate,
  free_rate,
  premium_rate,
  monthly_promo_cap,
}: {
  plan: string | null;
  welcome_free_rate: number | null;
  welcome_premium_rate: number | null;
  free_rate: number | null;
  premium_rate: number | null;
  monthly_promo_cap: number | null;
}) {
  const current = computeVisibility({
    plan,
    welcome_free_rate,
    welcome_premium_rate,
    free_rate,
    premium_rate,
    monthly_promo_cap,
  });
  const currentIdx = VISIBILITY_LEVELS.indexOf(current);

  return (
    <section className="border-border bg-card rounded-2xl border p-4 shadow-[0_10px_30px_-22px_rgba(236,72,153,0.6)]">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold tracking-tight">Visibility</h3>
        <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Step {currentIdx + 1} of {VISIBILITY_LEVELS.length}
        </span>
      </div>
      <p className="font-display text-foreground mt-1 text-2xl font-semibold leading-none tracking-tight">
        {current}
      </p>
      <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
        Plan, discount rates, and ticket cap all add up.
      </p>

      <div className="mt-5 flex items-center">
        {VISIBILITY_LEVELS.map((label, i) => {
          const reached = i < currentIdx;
          const isCurrent = i === currentIdx;
          return (
            <Fragment key={label}>
              {i > 0 && (
                <div
                  className={
                    "h-1.5 flex-1 rounded-full " +
                    (i <= currentIdx ? "bg-pink-gradient" : "bg-muted/80")
                  }
                />
              )}
              <div
                className={
                  "shrink-0 rounded-full transition " +
                  (isCurrent
                    ? "bg-pink-gradient shadow-glow ring-pink-500/30 h-4 w-4 ring-4"
                    : reached
                      ? "bg-pink-gradient h-3 w-3"
                      : "bg-muted/80 h-3 w-3")
                }
              />
            </Fragment>
          );
        })}
      </div>

      <div className="mt-2 flex justify-between text-[9px] font-semibold tracking-wider uppercase">
        {VISIBILITY_LEVELS.map((label, i) => (
          <span
            key={label}
            className={i === currentIdx ? "text-foreground" : "text-muted-foreground/70"}
          >
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

function SubscriptionCard({
  id,
  label,
  price,
  cadence,
  tagline,
  visibility,
  setup,
  featured,
  isCurrent,
  pending,
  onPick,
}: {
  id: SubscriptionId;
  label: string;
  price: string;
  cadence: string;
  tagline: string;
  visibility: PlanVisibility;
  setup?: string;
  featured: boolean;
  isCurrent: boolean;
  pending: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={isCurrent || pending}
      className={
        "border-border bg-card relative flex flex-col gap-2 rounded-2xl border p-4 text-left transition disabled:cursor-default " +
        (isCurrent
          ? "border-foreground shadow-elev ring-1 ring-foreground/10"
          : "hover:border-foreground/30 hover:-translate-y-0.5") +
        (featured && !isCurrent ? " bg-pink-gradient/[0.04]" : "")
      }
    >
      {isCurrent && (
        <span className="bg-foreground text-background absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider uppercase">
          Current
        </span>
      )}
      {!isCurrent && featured && (
        <span className="bg-pink-gradient absolute top-3 right-3 rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider text-white uppercase">
          Recommended
        </span>
      )}
      <div className="flex items-center gap-2 pr-16">
        {id !== "free" && (
          <span className="bg-muted text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
            {id === "ultra_discount" ? (
              <Crown className="h-3.5 w-3.5" />
            ) : (
              <Percent className="h-3.5 w-3.5" />
            )}
          </span>
        )}
        <span className="font-display min-w-0 truncate text-base font-semibold tracking-tight">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-foreground text-lg leading-none font-bold tabular-nums">
          {price}
        </span>
        <span className="text-muted-foreground text-[11px]">{cadence}</span>
      </div>
      <p className="text-muted-foreground text-[12px] leading-snug">{tagline}</p>
      <div className="mt-auto flex flex-col gap-0.5">
        <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
          {visibility} visibility
        </p>
        {setup && (
          <p className="text-muted-foreground/80 text-[10px] font-semibold tracking-[0.14em] uppercase">
            {setup} setup
          </p>
        )}
      </div>
    </button>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  tone,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  tone?: "off";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-8 min-w-11 rounded-lg border px-2.5 text-xs font-semibold tabular-nums transition disabled:opacity-40 ${
        active
          ? tone === "off"
            ? "border-muted-foreground/40 bg-muted text-foreground"
            : "border-foreground bg-foreground text-background"
          : "border-border bg-card hover:border-foreground/40"
      }`}
    >
      {children}
    </button>
  );
}
