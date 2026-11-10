"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Library, Loader2, Search } from "lucide-react";

import { listAllPlaces, searchPlacesByGoogleIds } from "./actions";
import { MAX_GOOGLE_PLACE_IDS, parseGooglePlaceIds } from "./google-place-ids";
import { IdListField } from "./IdListField";
import { ChoicePill } from "@/components/admin-ui/config";
import type { Row } from "./mesita-search-facts";
import { STATE_FILTER_COLUMNS, stateValueOf } from "./place-state-cells";
import { MesitaSearchResults } from "./MesitaSearchResults";

/** Which button is mid-flight — both share the table below. */
type Run = "ids" | "all";

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
  // The state filter (MESITA-3395 for Stripe; every state of Main §10 since
  // MESITA-3595): pick a state, then one of the values the run holds. It
  // narrows the table, never the run, so the summary and the shared ID box
  // still speak for the whole run.
  const [stateKey, setStateKey] = useState<string>("stripe");
  const [stateValue, setStateValue] = useState<string | null>(null);
  const column =
    STATE_FILTER_COLUMNS.find((c) => c.key === stateKey) ?? STATE_FILTER_COLUMNS[0];
  const valueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      const v = stateValueOf(row, column);
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows, column]);
  const shown = useMemo(
    () =>
      stateValue === null
        ? rows
        : (rows ?? []).filter((row) => stateValueOf(row, column) === stateValue),
    [rows, column, stateValue],
  );
  const busy = running !== null;
  const fail = (message: string) => {
    setError(message);
    setRows(null);
    setSummary(null);
  };

  async function runLookup() {
    if (busy || placeIds.length === 0) return;
    setRunning("ids");
    setError(null);
    try {
      const r = await searchPlacesByGoogleIds(placeIds);
      if (!r.ok) {
        fail(r.error);
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
      setStateValue(null);
      const found = next.filter((row) => row.hit !== null).length;
      setSummary(`${found} of ${next.length} on Mesita`);
    } catch (err) {
      fail(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(null);
    }
  }

  // The whole catalog, no paste required — and the shortcut: every Google
  // Place ID it finds lands in the shared box, so the catalog moves on to a
  // lookup, or to Create, Enrich and Update, without anyone pasting 250 lines. The box
  // caps where parseGooglePlaceIds caps, and a place with no
  // google_place_id has no token to give — the summary says both out loud.
  async function runAllPlaces() {
    if (busy) return;
    setRunning("all");
    setError(null);
    try {
      const r = await listAllPlaces();
      if (!r.ok) {
        fail(r.error);
        return;
      }
      const { places, total } = r.data;
      setStateValue(null);
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
      fail(err instanceof Error ? err.message : String(err));
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
        <div
          role="group"
          aria-label="Filter by state"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <label
            htmlFor="mesita-search-state"
            className="text-muted-foreground type-label font-semibold tracking-[0.12em] uppercase"
          >
            State
          </label>
          <select
            id="mesita-search-state"
            value={column.key}
            onChange={(e) => {
              setStateKey(e.target.value);
              setStateValue(null);
            }}
            className="border-border bg-background h-9 rounded-full border px-3 text-sm"
          >
            {(["Profile", "Place"] as const).map((group) => (
              <optgroup key={group} label={`${group} States`}>
                {STATE_FILTER_COLUMNS.filter((c) => c.group === group).map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChoicePill active={stateValue === null} onClick={() => setStateValue(null)}>
            All {rows.length}
          </ChoicePill>
          {valueCounts.map(([value, n]) => (
            <ChoicePill
              key={value}
              active={stateValue === value}
              onClick={() => setStateValue(value)}
            >
              {value} {n}
            </ChoicePill>
          ))}
        </div>
      ) : null}

      {shown && rows && rows.length > 0 && shown.length === 0 ? (
        <p className="text-muted-foreground mt-6 text-sm">
          No places with {column.label} {stateValue}.
        </p>
      ) : null}

      {shown && shown.length > 0 ? <MesitaSearchResults rows={shown} /> : null}
    </div>
  );
}
