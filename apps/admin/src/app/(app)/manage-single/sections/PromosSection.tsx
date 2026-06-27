"use client";

import { useState, useTransition } from "react";
import { Crown, Loader2, Percent } from "lucide-react";
import { updatePlace, type AdminPlace } from "../actions";
import { ErrorNote, SectionCard } from "../ui";

type Sub = "free" | "pro_discount" | "ultra_discount";
type RateCol = "welcome_free_rate" | "welcome_premium_rate" | "free_rate" | "premium_rate";

const RATE_CHOICES = [10, 20, 50, 70] as const;
const CAP_CHOICES = [200, 500, 1000, 2000] as const;

const SUBS: { id: Sub; label: string; hint: string }[] = [
  { id: "free", label: "Free", hint: "Listed, no discounts" },
  { id: "pro_discount", label: "Pro", hint: "Medium visibility" },
  { id: "ultra_discount", label: "Ultra", hint: "Max visibility" },
];

const RATE_ROWS: { col: RateCol; label: string; hint: string }[] = [
  { col: "welcome_free_rate", label: "Welcome · Free", hint: "First visit, Free users" },
  { col: "welcome_premium_rate", label: "Welcome · Premium", hint: "First visit, Premium users" },
  { col: "free_rate", label: "Returning · Free", hint: "Repeat visit, Free users" },
  { col: "premium_rate", label: "Returning · Premium", hint: "Repeat visit, Premium users" },
];

function subForPlan(plan: string | null): Sub {
  if (plan === "informal_ultra" || plan === "formal_ultra") return "ultra_discount";
  if (plan === "informal_pro" || plan === "formal_pro") return "pro_discount";
  return "free";
}

function dbStateForSub(sub: Sub): { plan: string; fiscal_type?: string } {
  if (sub === "pro_discount") return { plan: "informal_pro", fiscal_type: "informal" };
  if (sub === "ultra_discount") return { plan: "informal_ultra", fiscal_type: "informal" };
  return { plan: "free" };
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
  const sub = subForPlan(v.plan);
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
    <SectionCard
      icon={<Percent className="text-muted-foreground h-4 w-4" />}
      title="Promos"
      subtitle="Subscription plan, discount rates per user tier & visit, and the ticket cap. Discount-only — the place never holds money."
      action={pending ? <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" /> : null}
    >
      {/* Plan */}
      <p className="text-muted-foreground mt-5 text-[11px] font-semibold tracking-[0.12em] uppercase">
        Plan
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {SUBS.map((s) => {
          const active = sub === s.id;
          return (
            <button
              key={s.id}
              type="button"
              disabled={pending}
              onClick={() => persist(dbStateForSub(s.id))}
              className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:border-foreground/40"
              }`}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Crown className="h-3.5 w-3.5" /> {s.label}
              </span>
              <span className={active ? "text-background/70 text-xs" : "text-muted-foreground text-xs"}>
                {s.hint}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rates */}
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

      {/* Cap */}
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
