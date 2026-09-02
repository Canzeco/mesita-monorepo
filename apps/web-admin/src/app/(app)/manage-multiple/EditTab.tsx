"use client";

import {
  searchPlacesByGoogleIds,
  setPlaceActive,
  setPlaceListed,
  setPlacePlan,
  setPlaceStrategy,
  setPlaceVerified,
} from "../manage-single/actions";
import {
  DEFAULT_DISCOUNT_CAP_MXN,
  STRATEGY_BY_ID,
  type StrategyId,
} from "@/lib/business/strategies";
import type { BatchRowStatus } from "./StatusIcon";

export type EditFact = "listed" | "active" | "verified" | "partner" | "promoting";

export type EditValues = {
  listedOn: boolean;
  activeOn: boolean;
  partnerOn: boolean;
  promoting: 0 | 1 | 2;
};

export const DEFAULT_EDIT_VALUES: EditValues = {
  listedOn: true,
  activeOn: true,
  partnerOn: true,
  promoting: 0,
};

type Row = {
  status: BatchRowStatus;
  name?: string;
  detail?: string;
  error?: string;
};

function strategyRates(id: StrategyId): Record<string, number | null> {
  const rates = STRATEGY_BY_ID[id].rates;
  if (id === "zero") return { ...rates, monthly_promo_cap: null };
  return { ...rates, monthly_promo_cap: DEFAULT_DISCOUNT_CAP_MXN };
}

// max-w-full: a <select> sizes to its widest option, and "Off · also unlists"
// is wider than the card is on a phone.
const SELECT_CLASS =
  "border-border bg-background h-10 max-w-full min-w-0 rounded-xl border px-3 text-sm outline-none";

// State + value next to Update. Listed · Active · Verified · Partnered · Promoted.
export function UpdateFields({
  fact,
  onFact,
  values,
  onValues,
  disabled,
}: {
  fact: EditFact;
  onFact: (next: EditFact) => void;
  values: EditValues;
  onValues: (next: EditValues) => void;
  disabled: boolean;
}) {
  return (
    <>
      <label className="sr-only" htmlFor="intake-update-state">
        State
      </label>
      <select
        id="intake-update-state"
        aria-label="State"
        value={fact}
        disabled={disabled}
        onChange={(e) => onFact(e.target.value as EditFact)}
        className={SELECT_CLASS}
      >
        <option value="listed">Listed</option>
        <option value="active">Active</option>
        <option value="verified">Verified</option>
        <option value="partner">Partnered</option>
        <option value="promoting">Visit Rewards</option>
      </select>
      {fact === "listed" ? (
        <ValueSelect
          ariaLabel="Value"
          disabled={disabled}
          value={values.listedOn ? "on" : "off"}
          onChange={(v) => onValues({ ...values, listedOn: v === "on" })}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
          ]}
        />
      ) : null}
      {fact === "active" ? (
        <ValueSelect
          ariaLabel="Value"
          disabled={disabled}
          value={values.activeOn ? "on" : "off"}
          onChange={(v) => onValues({ ...values, activeOn: v === "on" })}
          options={[
            { value: "on", label: "On" },
            { value: "off", label: "Off · also unlists" },
          ]}
        />
      ) : null}
      {fact === "partner" ? (
        <ValueSelect
          ariaLabel="Value"
          disabled={disabled}
          value={values.partnerOn ? "on" : "off"}
          onChange={(v) => onValues({ ...values, partnerOn: v === "on" })}
          options={[
            { value: "on", label: "On · plan pro" },
            { value: "off", label: "Off · plan free" },
          ]}
        />
      ) : null}
      {fact === "promoting" ? (
        <ValueSelect
          ariaLabel="Value"
          disabled={disabled}
          value={String(values.promoting)}
          onChange={(v) =>
            onValues({ ...values, promoting: Number(v) as 0 | 1 | 2 })
          }
          options={[
            { value: "0", label: "0 · Zero" },
            { value: "1", label: "1 · Conservative" },
            { value: "2", label: "2 · Aggressive" },
          ]}
        />
      ) : null}
    </>
  );
}

function ValueSelect({
  ariaLabel,
  value,
  onChange,
  options,
  disabled,
}: {
  ariaLabel: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  disabled: boolean;
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={SELECT_CLASS}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export async function applyOne(
  googleId: string,
  fact: EditFact,
  values: EditValues,
): Promise<Row> {
  const looked = await searchPlacesByGoogleIds([googleId]);
  if (!looked.ok) return { status: "error", error: looked.error };
  const hit =
    looked.data.find((p) => p.google_place_id === googleId) ?? looked.data[0];
  if (!hit) return { status: "error", error: "Not on Mesita" };
  const name = hit.google_name || hit.name;

  if (fact === "listed") {
    const r = await setPlaceListed(hit.id, values.listedOn);
    if (!r.ok) return { status: "error", name, error: r.error };
    return {
      status: "ok",
      name,
      detail: values.listedOn ? "Listed on" : "Listed off",
    };
  }
  if (fact === "active") {
    const r = await setPlaceActive(hit.id, values.activeOn);
    if (!r.ok) return { status: "error", name, error: r.error };
    return {
      status: "ok",
      name,
      detail: values.activeOn ? "Active on" : "Active off · unlisted",
    };
  }
  if (fact === "verified") {
    const r = await setPlaceVerified(hit.id);
    if (!r.ok) return { status: "error", name, error: r.error };
    return {
      status: r.data.alreadyVerified ? "existed" : "ok",
      name,
      detail: r.data.alreadyVerified ? "Already verified" : "Verified yes",
    };
  }
  if (fact === "partner") {
    // Plan-only write. Rates ride Promoted, not Partner — do not zero
    // a live strategy when flipping membership.
    const r = await setPlacePlan(hit.id, values.partnerOn ? "pro" : "free");
    if (!r.ok) return { status: "error", name, error: r.error };
    return {
      status: "ok",
      name,
      detail: values.partnerOn ? "Partner on" : "Partner off",
    };
  }
  const strategy: StrategyId =
    values.promoting === 0
      ? "zero"
      : values.promoting === 1
        ? "conservative"
        : "aggressive";
  const r = await setPlaceStrategy(hit.id, strategyRates(strategy));
  if (!r.ok) return { status: "error", name, error: r.error };
  return {
    status: "ok",
    name,
    detail: `Promoted ${values.promoting}`,
  };
}
