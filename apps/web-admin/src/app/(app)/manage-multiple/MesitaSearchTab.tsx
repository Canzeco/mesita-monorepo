"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Library, Loader2, Search } from "lucide-react";

import {
  listAllPlaces,
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
import { MAX_GOOGLE_PLACE_IDS, parseGooglePlaceIds } from "./google-place-ids";
import { IdListField } from "./IdListField";
import { STICKY_COL_CELL, STICKY_COL_HEAD } from "@/lib/ui-classes";

// One table row. A paste run keys by the pasted Google Place ID and may have
// no hit ("Not on Mesita"); an All places run keys by the Mesita id and always
// has one — a place with no google_place_id still belongs in the catalog.
type Row = { key: string; googleId: string | null; hit: PlaceHit | null };

/** Which button is mid-flight — both share the table below. */
type Run = "ids" | "all";

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
  const [running, setRunning] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const busy = running !== null;

  async function runLookup() {
    if (busy || placeIds.length === 0) return;
    setRunning("ids");
    setError(null);
    try {
      const r = await searchPlacesByGoogleIds(placeIds);
      if (!r.ok) {
        setError(r.error);
        setRows(null);
        setSummary(null);
        return;
      }
      const byGid = new Map(
        r.data
          .filter((p) => p.google_place_id)
          .map((p) => [p.google_place_id as string, p]),
      );
      const next: Row[] = placeIds.map((googleId) => ({
        key: googleId,
        googleId,
        hit: byGid.get(googleId) ?? null,
      }));
      setRows(next);
      const found = next.filter((row) => row.hit !== null).length;
      setSummary(`${found} of ${next.length} on Mesita`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows(null);
      setSummary(null);
    } finally {
      setRunning(null);
    }
  }

  // The whole catalog, no paste required — and the shortcut: every Google
  // Place ID it finds lands in the shared box, so the catalog moves on to a
  // lookup, or to Mesita Intake, without anyone pasting 250 lines. The box
  // caps where parseGooglePlaceIds caps, and a place with no
  // google_place_id has no token to give — the summary says both out loud.
  async function runAllPlaces() {
    if (busy) return;
    setRunning("all");
    setError(null);
    try {
      const r = await listAllPlaces();
      if (!r.ok) {
        setError(r.error);
        setRows(null);
        setSummary(null);
        return;
      }
      const { places, total } = r.data;
      setRows(
        places.map((hit) => ({
          key: hit.id,
          googleId: hit.google_place_id,
          hit,
        })),
      );
      const withIds = places
        .map((hit) => hit.google_place_id)
        .filter((id): id is string => Boolean(id));
      const ids = withIds.slice(0, MAX_GOOGLE_PLACE_IDS);
      onTextChange(ids.join("\n"));
      const caught =
        places.length < total
          ? `${places.length} of ${total} places (capped)`
          : `${places.length} place${places.length === 1 ? "" : "s"} on Mesita`;
      const missing = places.length - withIds.length;
      setSummary(
        `${caught} · ${ids.length} ID${ids.length === 1 ? "" : "s"} in the box` +
          (missing > 0 ? `, ${missing} without a Google ID` : ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRows(null);
      setSummary(null);
    } finally {
      setRunning(null);
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
        running={busy}
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void runLookup()}
          disabled={busy || placeIds.length === 0}
          className="bg-foreground text-background inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-semibold disabled:opacity-50"
        >
          {running === "ids" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Search className="h-3.5 w-3.5" />
          )}
          {running === "ids" ? "Looking up…" : "Look up on Mesita"}
        </button>
        <button
          type="button"
          onClick={() => void runAllPlaces()}
          disabled={busy}
          className="border-border hover:border-foreground/40 inline-flex h-10 items-center gap-2 rounded-full border px-5 text-sm font-medium transition disabled:opacity-50"
        >
          {running === "all" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Library className="h-3.5 w-3.5" />
          )}
          {running === "all" ? "Loading…" : "All places"}
        </button>
        {summary ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {summary}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="border-destructive/40 bg-destructive/5 text-destructive mt-6 flex items-start gap-3 rounded-2xl border p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      ) : null}

      {rows && rows.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">No places to show.</p>
      ) : null}

      {rows && rows.length > 0 ? (
        // Bleeds through the card's padding on a phone so the scrollport is
        // the full screen rather than the ~295px left inside it.
        <div className="border-border bg-card -mx-5 mt-6 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase">
                  <th className={`px-4 py-3 font-semibold ${STICKY_COL_HEAD}`}>
                    Place
                  </th>
                  {GENERAL_STATUS_FACTS.map((f) => (
                    <th key={f.key} className="px-3 py-3 text-center font-semibold">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  // Bind the hit to a const first: narrowing `row.hit` would
                  // not survive into the per-fact closures below.
                  const hit = row.hit;
                  return (
                    <tr
                      key={row.key}
                      className="[&>td]:border-border/60 [&>td]:border-t"
                    >
                      <td
                        className={`max-w-[60vw] px-4 py-3 sm:max-w-[280px] ${STICKY_COL_CELL}`}
                      >
                        {hit ? (
                          <p className="truncate font-medium">
                            {hit.google_name || hit.name}
                          </p>
                        ) : (
                          <>
                            <p className="text-muted-foreground font-mono text-xs">
                              {row.googleId}
                            </p>
                            <p className="text-muted-foreground type-label">
                              Not on Mesita
                            </p>
                          </>
                        )}
                      </td>
                      {hit
                        ? GENERAL_STATUS_FACTS.map((f) => (
                            <td key={f.key} className="px-3 py-3 text-center">
                              {f.key === "promoting" ? (
                                <span className="tabular-nums">
                                  {operatorPromotingLevel(hit.promoting_level)}{" "}
                                  <span className="text-muted-foreground type-label">
                                    {
                                      OPERATOR_PROMOTING_LABEL[
                                        operatorPromotingLevel(hit.promoting_level)
                                      ]
                                    }
                                  </span>
                                </span>
                              ) : f.key === "requested" ? (
                                <span
                                  className={
                                    "type-label font-semibold tabular-nums " +
                                    (hit.request_count > 0
                                      ? "text-foreground"
                                      : "text-muted-foreground")
                                  }
                                >
                                  {hit.request_count}
                                </span>
                              ) : (
                                <StatePill
                                  on={factOn(hit, f.key)}
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
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.some((r) => r.hit && r.hit.enrich_pulse_labels.length > 0) ? (
            <ul className="border-border divide-border divide-y border-t">
              {rows.map((row) => {
                const hit = row.hit;
                if (!hit || hit.enrich_pulse_labels.length === 0) return null;
                return (
                  <li key={`${row.key}-intake`} className="px-4 py-3">
                    <p className="text-muted-foreground type-label mb-2">
                      Intake · {hit.google_name || hit.name}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {INTAKE_FUNCTIONS.map((fn) => {
                        const called = hit.enrich_pulse >= fn.n;
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
