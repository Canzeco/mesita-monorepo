"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";

import {
  searchPlacesByGoogleIds,
  type PlaceHit,
} from "../manage-single/actions";
import {
  GENERAL_STATUS_FACTS,
  INTAKE_FUNCTIONS,
  OPERATOR_PROMOTING_LABEL,
  operatorPromotingLevel,
  STATUS_FACT_FALSE_TONE,
} from "@/lib/status-vocabulary";
import { parseGooglePlaceIds } from "./google-place-ids";
import { IdListField } from "./IdListField";

type Row =
  | { googleId: string; hit: PlaceHit }
  | { googleId: string; hit: null };

function factOn(hit: PlaceHit, key: (typeof GENERAL_STATUS_FACTS)[number]["key"]): boolean {
  if (key === "seeded") return hit.seeded;
  if (key === "active") return hit.business_status === "OPERATIONAL";
  if (key === "listed") return hit.listed;
  if (key === "requested") return hit.request_count > 0;
  if (key === "enriched") {
    return hit.enrich_pulse_total > 0 && hit.enrich_pulse === hit.enrich_pulse_total;
  }
  if (key === "enriching") return hit.enriching;
  if (key === "verified") return hit.verified;
  if (key === "partner") return hit.partner;
  if (key === "promoting") return hit.promoting;
  if (key === "mesita_pay") return hit.mesita_pay;
  if (key === "credits") return hit.credits;
  return false;
}

export function MesitaSearchTab({
  text,
  onTextChange,
}: {
  text: string;
  onTextChange: (next: string) => void;
}) {
  const placeIds = useMemo(() => parseGooglePlaceIds(text), [text]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);

  async function runLookup() {
    if (running || placeIds.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const r = await searchPlacesByGoogleIds(placeIds);
      if (!r.ok) {
        setError(r.error);
        setRows(null);
        return;
      }
      const byGid = new Map(
        r.data
          .filter((p) => p.google_place_id)
          .map((p) => [p.google_place_id as string, p]),
      );
      setRows(
        placeIds.map((googleId) => ({
          googleId,
          hit: byGid.get(googleId) ?? null,
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows(null);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      <IdListField
        id="mesita-search-ids"
        label="Google Place IDs"
        text={text}
        onTextChange={onTextChange}
        placeIds={placeIds}
        running={running}
      />
      <div className="mt-4">
        <button
          type="button"
          onClick={() => void runLookup()}
          disabled={running || placeIds.length === 0}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {running ? "Looking up…" : "Look up on Mesita"}
        </button>
      </div>

      {error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {rows ? (
        <div className="border-border bg-card mt-6 overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase">
                  <th className="px-4 py-3 font-semibold">Place</th>
                  {GENERAL_STATUS_FACTS.map((f) => (
                    <th key={f.key} className="px-3 py-3 text-center font-semibold">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.googleId} className="[&>td]:border-border/60 [&>td]:border-t">
                    <td className="max-w-[280px] px-4 py-3">
                      {row.hit ? (
                        <p className="truncate font-medium">
                          {row.hit.google_name || row.hit.name}
                        </p>
                      ) : (
                        <p className="text-muted-foreground font-mono text-xs">
                          {row.googleId}
                        </p>
                      )}
                      {!row.hit ? (
                        <p className="text-muted-foreground type-label">
                          Not on Mesita
                        </p>
                      ) : null}
                    </td>
                    {row.hit
                      ? GENERAL_STATUS_FACTS.map((f) => (
                          <td key={f.key} className="px-3 py-3 text-center">
                            {f.key === "promoting" ? (
                              <span className="tabular-nums">
                                {operatorPromotingLevel(row.hit.promoting_level)}{" "}
                                <span className="text-muted-foreground type-label">
                                  {
                                    OPERATOR_PROMOTING_LABEL[
                                      operatorPromotingLevel(row.hit.promoting_level)
                                    ]
                                  }
                                </span>
                              </span>
                            ) : f.key === "requested" ? (
                              <span
                                className={
                                  "type-label font-semibold tabular-nums " +
                                  (row.hit.request_count > 0
                                    ? "text-foreground"
                                    : "text-muted-foreground")
                                }
                              >
                                {row.hit.request_count}
                              </span>
                            ) : (
                              <StatePill
                                on={factOn(row.hit, f.key)}
                                falseTone={STATUS_FACT_FALSE_TONE[f.key]}
                              />
                            )}
                          </td>
                        ))
                      : GENERAL_STATUS_FACTS.map((f) => (
                          <td
                            key={f.key}
                            className="text-muted-foreground px-3 py-3 text-center"
                          >
                            —
                          </td>
                        ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.some((r) => r.hit && r.hit.enrich_pulse_labels.length > 0) ? (
            <ul className="border-border divide-border divide-y border-t">
              {rows.map((row) => {
                if (!row.hit || row.hit.enrich_pulse_labels.length === 0) return null;
                return (
                  <li key={`${row.googleId}-intake`} className="px-4 py-3">
                    <p className="text-muted-foreground type-label mb-2">
                      Intake · {row.hit.google_name || row.hit.name}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {INTAKE_FUNCTIONS.map((fn) => {
                        const called = row.hit!.enrich_pulse >= fn.n;
                        return (
                          <span
                            key={fn.key}
                            className={
                              "rounded-full px-2 py-0.5 type-label font-medium " +
                              (called
                                ? "bg-green-500/10 text-green-700"
                                : "bg-muted text-muted-foreground")
                            }
                          >
                            {fn.n}. {fn.label}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// falseTone comes from the fact vocabulary (STATUS_FACT_FALSE_TONE): rose for
// a pending debt, plain grey for a fact that is merely not true — the same
// taxonomy the catalog's BoolCell uses, so the two tables can't disagree.
function StatePill({
  on,
  falseTone = "pending",
}: {
  on: boolean;
  falseTone?: "pending" | "neutral";
}) {
  return (
    <span
      className={
        "inline-flex items-center justify-center rounded-full px-2 py-0.5 type-label font-semibold " +
        (on
          ? "bg-green-500/10 text-green-700"
          : falseTone === "neutral"
            ? "text-muted-foreground bg-muted"
            : "bg-rose-500/10 text-rose-700")
      }
    >
      {on ? "yes" : "no"}
    </span>
  );
}
