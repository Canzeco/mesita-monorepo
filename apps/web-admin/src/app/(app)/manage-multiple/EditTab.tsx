"use client";

import { useMemo, useState } from "react";
import { Loader2, Pencil } from "lucide-react";
import {
  searchPlacesByGoogleIds,
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
import { parseGooglePlaceIds } from "./google-place-ids";
import { IdListField } from "./IdListField";
import { StatusIcon, type BatchRowStatus } from "./StatusIcon";

const CONCURRENCY = 4;

type EditFact = "listed" | "verified" | "partner" | "promoting";

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

export function EditTab({
  text,
  onTextChange,
}: {
  text: string;
  onTextChange: (next: string) => void;
}) {
  const placeIds = useMemo(() => parseGooglePlaceIds(text), [text]);
  const [fact, setFact] = useState<EditFact>("listed");
  const [listedOn, setListedOn] = useState(true);
  const [partnerOn, setPartnerOn] = useState(true);
  const [promoting, setPromoting] = useState<0 | 1 | 2>(0);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, Row>>({});

  const done = placeIds.filter((id) => {
    const s = results[id]?.status;
    return s === "ok" || s === "existed" || s === "error";
  }).length;
  const okCount = placeIds.filter((id) => {
    const s = results[id]?.status;
    return s === "ok" || s === "existed";
  }).length;
  const failed = placeIds.filter((id) => results[id]?.status === "error").length;

  async function runAll() {
    if (running || placeIds.length === 0) return;
    setRunning(true);
    setResults(
      Object.fromEntries(placeIds.map((id) => [id, { status: "pending" as const }])),
    );
    const ids = [...placeIds];
    let cursor = 0;
    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        setResults((prev) => ({ ...prev, [id]: { status: "running" } }));
        try {
          const row = await applyOne(id, fact, { listedOn, partnerOn, promoting });
          setResults((prev) => ({ ...prev, [id]: row }));
        } catch (err) {
          setResults((prev) => ({
            ...prev,
            [id]: {
              status: "error",
              error: err instanceof Error ? err.message : "Unexpected error",
            },
          }));
        }
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, ids.length) }, worker),
    );
    setRunning(false);
  }

  return (
    <div>
      <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
        The only edit on this page. Google Place IDs plus one state: Listed,
        Verified, Partner, or Promoting. No other fields.
      </p>

      <div className="border-border bg-card mt-6 rounded-2xl border p-6">
        <IdListField
          id="edit-place-ids"
          label="Google Place IDs"
          text={text}
          onTextChange={onTextChange}
          placeIds={placeIds}
          running={running}
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            State
            <select
              value={fact}
              disabled={running}
              onChange={(e) => setFact(e.target.value as EditFact)}
              className="border-border bg-background mt-1 block h-10 w-full rounded-xl border px-3 text-sm outline-none"
            >
              <option value="listed">Listed</option>
              <option value="verified">Verified</option>
              <option value="partner">Partner</option>
              <option value="promoting">Promoting</option>
            </select>
          </label>
          {fact === "listed" ? (
            <ValueSelect
              label="Value"
              disabled={running}
              value={listedOn ? "on" : "off"}
              onChange={(v) => setListedOn(v === "on")}
              options={[
                { value: "on", label: "On" },
                { value: "off", label: "Off" },
              ]}
            />
          ) : null}
          {fact === "verified" ? (
            <p className="text-muted-foreground self-end text-sm">
              Value is <span className="text-foreground font-medium">yes</span> —
              ownership proof, one-time, never lapses.
            </p>
          ) : null}
          {fact === "partner" ? (
            <ValueSelect
              label="Value"
              disabled={running}
              value={partnerOn ? "on" : "off"}
              onChange={(v) => setPartnerOn(v === "on")}
              options={[
                { value: "on", label: "On · plan pro" },
                { value: "off", label: "Off · plan free" },
              ]}
            />
          ) : null}
          {fact === "promoting" ? (
            <ValueSelect
              label="Value"
              disabled={running}
              value={String(promoting)}
              onChange={(v) => setPromoting(Number(v) as 0 | 1 | 2)}
              options={[
                { value: "0", label: "0 · Zero" },
                { value: "1", label: "1 · Conservative" },
                { value: "2", label: "2 · Aggressive" },
              ]}
            />
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void runAll()}
            disabled={running || placeIds.length === 0}
            className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pencil className="h-3.5 w-3.5" />
            )}
            {running ? `Writing… ${done}/${placeIds.length}` : "Apply"}
          </button>
          {done > 0 ? (
            <span className="text-muted-foreground text-xs">
              {okCount} written · {failed} failed
            </span>
          ) : null}
        </div>
      </div>

      {Object.keys(results).length > 0 ? (
        <div className="border-border bg-card mt-6 overflow-hidden rounded-2xl border">
          <ul className="divide-border/60 divide-y">
            {placeIds.map((id) => {
              const r = results[id];
              if (!r) return null;
              return (
                <li key={id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <StatusIcon status={r.status} />
                  <div className="min-w-0 flex-1">
                    {r.name ? (
                      <span className="truncate font-medium">{r.name}</span>
                    ) : (
                      <span className="text-muted-foreground font-mono text-xs">
                        {id}
                      </span>
                    )}
                    {r.detail ? (
                      <p className="text-muted-foreground type-label">{r.detail}</p>
                    ) : null}
                    {r.error ? (
                      <p className="text-destructive type-label">{r.error}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ValueSelect({
  label,
  value,
  onChange,
  options,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: { value: string; label: string }[];
  disabled: boolean;
}) {
  return (
    <label className="text-sm font-medium">
      {label}
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="border-border bg-background mt-1 block h-10 w-full rounded-xl border px-3 text-sm outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

async function applyOne(
  googleId: string,
  fact: EditFact,
  values: { listedOn: boolean; partnerOn: boolean; promoting: 0 | 1 | 2 },
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
    // Plan-only write. Rates ride Promoting, not Partner — do not zero
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
    detail: `Promoting ${values.promoting}`,
  };
}
