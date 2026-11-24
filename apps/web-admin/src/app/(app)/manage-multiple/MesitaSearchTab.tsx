"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Library, Send } from "lucide-react";

import { listPlacesBatch, type PlaceHit } from "./actions";
import { MAX_GOOGLE_PLACE_IDS } from "./google-place-ids";
import { Button, ChoicePill, EmptyState, Notice, SelectField } from "@/components/admin-ui";
import type { Row } from "./mesita-search-facts";
import { STATE_FILTER_COLUMNS, stateValueOf } from "./place-state-cells";
import { MesitaSearchResults } from "./MesitaSearchResults";
import { pageOf } from "./mesita-search-page";

/** The most batches one All places run asks for (2,000 places each) — the
 *  same cap listAllPlaces keeps. Past it the summary says "(capped)". */
const MAX_BATCHES = 50;

// Mesita Search (MESITA-3942): one button lists every place on Mesita. No ID
// or name input. The catalog loads batch by batch from the browser, so a
// failed batch keeps what loaded and Retry resumes from the cursor. The table
// shows 50 rows a page. A state filter narrows it, and "Use these N IDs"
// sends the shown rows to Mesita Edit, 250 at a time.

export function MesitaSearchTab({
  onSendIds,
  editRuns,
}: {
  onSendIds: (ids: string[], filter: string | null) => void;
  /** Bumped when an Edit or Delete run ends: the loaded states may be stale. */
  editRuns: number;
}) {
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [places, setPlaces] = useState<PlaceHit[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [batches, setBatches] = useState(0);
  const [stopped, setStopped] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [page, setPage] = useState(1);
  const [sentUpTo, setSentUpTo] = useState(0);
  const [sendNote, setSendNote] = useState<string | null>(null);
  // The state filter (MESITA-3395 for Stripe; every state of Main §10 since
  // MESITA-3595): pick a state, then one of the values the run holds. It
  // narrows the table and what "Use these N IDs" sends.
  const [stateKey, setStateKey] = useState<string>("stripe");
  const [stateValue, setStateValue] = useState<string | null>(null);

  const rows: Row[] | null = useMemo(
    () =>
      complete || places.length > 0
        ? places.map((hit) => ({ key: hit.id, googleId: hit.google_place_id, hit }))
        : null,
    [places, complete],
  );
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
        ? (rows ?? [])
        : (rows ?? []).filter((row) => stateValueOf(row, column) === stateValue),
    [rows, column, stateValue],
  );
  const view = pageOf(shown, page);
  const shownIds = useMemo(
    () => shown.map((r) => r.googleId).filter((id): id is string => Boolean(id)),
    [shown],
  );
  const withoutId = shown.length - shownIds.length;

  async function load(resume: boolean) {
    if (loading) return;
    setLoading(true);
    setStopped(null);
    let acc = resume ? [...places] : [];
    let after = resume ? cursor : null;
    let n = resume ? batches : 0;
    let tot = resume ? total : null;
    let failed = false;
    if (!resume) {
      setPlaces([]);
      setCursor(null);
      setBatches(0);
      setTotal(null);
      setComplete(false);
      setPage(1);
      setStateValue(null);
      setSentUpTo(0);
      setSendNote(null);
    }
    try {
      while (n < MAX_BATCHES) {
        const r = await listPlacesBatch(after);
        if (!r.ok) {
          failed = true;
          setStopped(r.error);
          break;
        }
        n += 1;
        acc = [...acc, ...r.data.places];
        if (r.data.total !== null) tot = Math.max(tot ?? 0, r.data.total);
        after = r.data.next;
        setPlaces(acc);
        setTotal(tot);
        setCursor(after);
        setBatches(n);
        if (!after) break;
      }
    } catch (err) {
      failed = true;
      setStopped(err instanceof Error ? err.message : String(err));
    }
    // Sort once, after the last batch, so rows do not jump while loading.
    const doneLoading = !failed && (!after || n >= MAX_BATCHES);
    if (doneLoading) {
      acc = [...acc].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
      setPlaces(acc);
      setComplete(true);
      setLoadedAt(editRuns);
    }
    setLoading(false);
  }

  function send(from: number) {
    const ids = shownIds.slice(from, from + MAX_GOOGLE_PLACE_IDS);
    if (ids.length === 0) return;
    const upTo = from + ids.length;
    setSentUpTo(upTo);
    const skipped = withoutId > 0 ? ` (${withoutId} without an ID skipped)` : "";
    setSendNote(
      shownIds.length > MAX_GOOGLE_PLACE_IDS
        ? `${from + 1}–${upTo} of ${shownIds.length} sent; ${shownIds.length - upTo} left out${skipped}`
        : `${ids.length} sent${skipped}`,
    );
    onSendIds(ids, stateValue === null ? null : `${column.label} ${stateValue}`);
  }

  const capped = total !== null && places.length < total;
  const summary = complete
    ? (capped
        ? `${places.length} of ${total} places (capped)`
        : `${places.length} place${places.length === 1 ? "" : "s"} on Mesita`) +
      (places.some((p) => !p.google_place_id)
        ? `, ${places.filter((p) => !p.google_place_id).length} without a Google ID`
        : "")
    : null;
  const stale = loadedAt !== null && editRuns > loadedAt;
  const sendCount = Math.min(shownIds.length, MAX_GOOGLE_PLACE_IDS);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          onClick={() => void load(false)}
          pending={loading}
          icon={<Library aria-hidden className="h-3.5 w-3.5" />}
        >
          {loading ? `Loading… ${places.length} places` : "All places"}
        </Button>
        {summary && !loading ? (
          <span className="text-muted-foreground text-xs tabular-nums">{summary}</span>
        ) : null}
        {stale && !loading ? (
          <Button tone="ghost" size="sm" onClick={() => void load(false)}>
            States changed. Reload
          </Button>
        ) : null}
      </div>

      {stopped && !loading ? (
        <Notice className="mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <p className="min-w-0 flex-1">
              Loaded {places.length}; stopped: {stopped}.
            </p>
            <Button tone="secondary" size="sm" onClick={() => void load(true)}>
              Retry
            </Button>
          </div>
        </Notice>
      ) : null}

      {complete && rows && rows.length === 0 ? (
        <EmptyState className="mt-6">No places to show.</EmptyState>
      ) : null}

      {complete && rows && rows.length > 0 ? (
        <div
          role="group"
          aria-label="Filter by state"
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <label
            htmlFor="mesita-search-state"
            className="text-muted-foreground type-eyebrow"
          >
            State
          </label>
          <SelectField
            id="mesita-search-state"
            value={column.key}
            onChange={(v) => {
              setStateKey(v);
              setStateValue(null);
              setPage(1);
              setSentUpTo(0);
              setSendNote(null);
            }}
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
          </SelectField>
          <ChoicePill
            active={stateValue === null}
            onClick={() => {
              setStateValue(null);
              setPage(1);
              setSentUpTo(0);
              setSendNote(null);
            }}
          >
            All {rows.length}
          </ChoicePill>
          {valueCounts.map(([value, n]) => (
            <ChoicePill
              key={value}
              active={stateValue === value}
              onClick={() => {
                setStateValue(value);
                setPage(1);
                setSentUpTo(0);
                setSendNote(null);
              }}
            >
              {value} {n}
            </ChoicePill>
          ))}
        </div>
      ) : null}

      {complete && rows && rows.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            tone="secondary"
            onClick={() => send(0)}
            disabled={shownIds.length === 0}
            icon={<Send aria-hidden className="h-3.5 w-3.5" />}
          >
            Use these {sendCount} IDs
          </Button>
          {sentUpTo > 0 && sentUpTo < shownIds.length ? (
            <Button tone="secondary" onClick={() => send(sentUpTo)}>
              Send next {Math.min(MAX_GOOGLE_PLACE_IDS, shownIds.length - sentUpTo)}
            </Button>
          ) : null}
          <span className="text-muted-foreground text-xs tabular-nums">
            {sendNote ??
              (withoutId > 0 ? `${withoutId} without an ID will be skipped` : null)}
            {capped ? " (capped)" : ""}
          </span>
        </div>
      ) : null}

      {complete && rows && rows.length > 0 && shown.length === 0 ? (
        <EmptyState className="mt-6">
          No places match {column.label} {stateValue}.
        </EmptyState>
      ) : null}

      {shown.length > 0 ? (
        <>
          <div
            className="mt-6 flex flex-wrap items-center gap-3 text-sm"
            aria-live="polite"
          >
            <span className="text-muted-foreground tabular-nums">
              {view.from}–{view.to} of {view.total}
              {complete ? "" : ` (${places.length} loaded)`}
            </span>
            <Button
              tone="secondary"
              size="icon"
              aria-label="Previous page"
              onClick={() => setPage(view.page - 1)}
              disabled={view.page <= 1}
            >
              <ChevronLeft aria-hidden className="h-4 w-4" />
            </Button>
            <Button
              tone="secondary"
              size="icon"
              aria-label="Next page"
              onClick={() => setPage(view.page + 1)}
              disabled={view.page >= view.pages}
            >
              <ChevronRight aria-hidden className="h-4 w-4" />
            </Button>
          </div>
          <MesitaSearchResults rows={view.rows} />
        </>
      ) : null}
    </div>
  );
}
