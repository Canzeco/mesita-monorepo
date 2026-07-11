"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Lock, Percent, ShieldCheck } from "lucide-react";
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

// Admin Promos — Buzz v4, dense. Same writes as the business console
// (strategy preset + Verified membership), without the marketing chrome.

const MEMBERSHIP_FEE_MXN = 1000;

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
  const [memberConfirm, setMemberConfirm] = useState<boolean | null>(null);

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
  const storedStrategy = strategyForPlace(v);
  const activeStrategy = STRATEGY_BY_ID[storedStrategy ?? "zero"];

  const applyStrategy = (target: StrategyId) => {
    if (pending || target === storedStrategy) return;
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

  const requestMembership = (member: boolean) => {
    if (pending || member === isMember) return;
    setMemberConfirm(member);
  };
  const commitMembership = () => {
    const member = memberConfirm;
    setMemberConfirm(null);
    if (member == null) return;
    persist(dbStateForSubscription(member ? "pro_discount" : "free"));
  };

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        icon={<Percent className="h-4 w-4" />}
        tint="pink"
        title="Discount strategy"
        subtitle={`One preset writes all four rates. Cap: first ${formatMoney(UNIVERSAL_CAP_MXN, v.currency)} of the bill.`}
        action={
          pending ? (
            <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
          ) : null
        }
      >
        {!isMember && (
          <p className="text-muted-foreground mt-3 flex items-center gap-1.5 text-[11px]">
            <Lock className="h-3 w-3 shrink-0" />
            Paid strategies need Verified membership (below).
          </p>
        )}

        <div className="border-border/60 mt-3 overflow-hidden rounded-xl border">
          {STRATEGIES.map((s, i) => (
            <StrategyRow
              key={s.id}
              strategy={s}
              selected={s.id === storedStrategy}
              pending={pending && s.id === storedStrategy}
              locked={s.id !== "zero" && !isMember}
              first={i === 0}
              onSelect={() => applyStrategy(s.id)}
            />
          ))}
        </div>

        {storedStrategy === null && (
          <p className="text-muted-foreground mt-2 text-[11px]">
            Current rates don&apos;t match a preset — pick one to standardize.
          </p>
        )}

        <div className="mt-4">
          <RatesSummary strategy={activeStrategy} />
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
        subtitle={`${formatMoney(MEMBERSHIP_FEE_MXN, v.currency)}/year signing fee — unlocks paid strategies. Admin sets plan flags only (no Stripe charge).`}
        action={<StatusPill active={isMember} />}
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ToggleButton
            active={isMember}
            disabled={pending}
            onClick={() => requestMembership(true)}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified
          </ToggleButton>
          <ToggleButton
            active={!isMember}
            disabled={pending}
            onClick={() => requestMembership(false)}
          >
            Zero
          </ToggleButton>
        </div>
      </SectionCard>

      <ConfirmDialog
        open={memberConfirm != null}
        title={
          memberConfirm ? "Set this place Verified?" : "Set this place to Zero?"
        }
        body={
          memberConfirm ? (
            <p>Unlocks Conservative → Dominant. Does not charge Stripe.</p>
          ) : (
            <p>
              Locks to Zero — paid promos stop applying until Verified again.
            </p>
          )
        }
        confirmLabel={memberConfirm ? "Set Verified" : "Set Zero"}
        busy={pending}
        onConfirm={commitMembership}
        onCancel={() => setMemberConfirm(null)}
      />
    </div>
  );
}

function StrategyRow({
  strategy,
  selected,
  pending,
  locked,
  first,
  onSelect,
}: {
  strategy: Strategy;
  selected: boolean;
  pending: boolean;
  locked: boolean;
  first: boolean;
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
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition",
        !first && "border-border/60 border-t",
        selected ? "bg-muted/50" : "bg-card",
        !selected && !locked && "hover:bg-muted/30",
        locked && "cursor-not-allowed opacity-55",
      )}
    >
      <span
        className={cx(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          selected
            ? "border-foreground bg-foreground text-background"
            : "border-border",
        )}
      >
        {selected ? <Check className="h-2.5 w-2.5" /> : null}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold tracking-tight">
            {strategy.name}
          </span>
          <span className="text-muted-foreground text-[11px]">
            {strategy.visibility} visibility
          </span>
        </div>
      </div>

      <span className="text-foreground/80 shrink-0 text-[12px] font-semibold tabular-nums">
        {top == null ? "No promos" : `up to ${top}%`}
      </span>

      {locked ? (
        <Lock className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      ) : pending ? (
        <Loader2 className="text-muted-foreground h-3.5 w-3.5 shrink-0 animate-spin" />
      ) : null}
    </button>
  );
}

function RatesSummary({ strategy }: { strategy: Strategy }) {
  if (strategy.id === "zero") {
    return (
      <p className="text-muted-foreground text-[12px]">
        Zero — catalog and organic lane only, no discounts.
      </p>
    );
  }

  const r = strategy.rates;
  return (
    <div>
      <GroupLabel>Rates · {strategy.name}</GroupLabel>
      <div className="border-border/60 mt-2 overflow-hidden rounded-xl border">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-border/60 bg-muted/30 border-b text-[10px] font-bold tracking-wide uppercase">
              <th className="text-muted-foreground px-3 py-2 font-bold">
                Visit
              </th>
              <th className="text-muted-foreground px-3 py-2 text-center font-bold">
                Free
              </th>
              <th className="px-3 py-2 text-center font-bold text-violet-600">
                Premium
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-border/60 border-b">
              <td className="text-foreground/70 px-3 py-2 font-medium">
                First
              </td>
              <td className="text-foreground/80 px-3 py-2 text-center tabular-nums">
                {formatPct(r.welcome_free_rate)}
              </td>
              <td className="bg-violet-500/[0.04] px-3 py-2 text-center font-semibold tabular-nums text-violet-600">
                {formatPct(r.welcome_premium_rate)}
              </td>
            </tr>
            <tr>
              <td className="text-foreground/70 px-3 py-2 font-medium">
                Returning
              </td>
              <td className="text-foreground/80 px-3 py-2 text-center tabular-nums">
                {formatPct(r.free_rate)}
              </td>
              <td className="bg-violet-500/[0.04] px-3 py-2 text-center font-semibold tabular-nums text-violet-600">
                {formatPct(r.premium_rate)}
              </td>
            </tr>
          </tbody>
        </table>
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
