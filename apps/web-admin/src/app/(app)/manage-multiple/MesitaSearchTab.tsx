"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Library, Loader2, Search } from "lucide-react";

import { listAllPlaces, searchPlacesByGoogleIds } from "./actions";
import { MAX_GOOGLE_PLACE_IDS, parseGooglePlaceIds } from "./google-place-ids";
import { IdListField } from "./IdListField";
import type { Row } from "./mesita-search-facts";
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
  // lookup, or to Crenup, without anyone pasting 250 lines. The box
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

      {rows && rows.length > 0 ? <MesitaSearchResults rows={rows} /> : null}
    </div>
  );
}
