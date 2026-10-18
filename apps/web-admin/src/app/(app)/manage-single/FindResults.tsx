"use client";

// Single Place › Find › the one results table (MESITA-2124, MESITA-2181,
// MESITA-2187, MESITA-2188). A row per place. The first column says whether
// Mesita holds it or it is Google only — the first fact to read. Then the
// states, then, on a word, Name Search and Google. 50 rows a page
// (MESITA-2335); no group header over the states.
// Reviews stay off this table (MESITA-2222). The action sits at the row end.
// Drawn once both have settled, so no row ever moves under the cursor.
//
// From 640px, On and Place stay pinned while the state columns scroll.
// Under that, On hides and the same pill sits in the Place cell: a second
// 9rem pin plus Place at 60vw would fill the phone. The two ranks fold
// into one line beneath the address.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ExternalLink, Loader2, Plus } from "lucide-react";
import { StatePill } from "@/app/(app)/manage-multiple/PlaceFacts";
import { factOn } from "@/app/(app)/manage-multiple/mesita-search-facts";
import { StateIcon, type BatchRowState } from "@/app/(app)/manage-multiple/StateIcon";
import { placeTabHref } from "@/lib/place-tabs";
import {
  BAD_WHEN_TRUE,
  GENERAL_STATE_FACTS,
  STATE_FACT_FALSE_TONE,
} from "@/lib/state-vocabulary";
import { ENRICH_ACTIONS, type EnrichDepth } from "@/lib/enrich-depth";
import {
  FOCUS_RING_CLASS,
  PILL_BUTTON_CLASS,
  TOUCH_TARGET_CLASS,
} from "@/lib/ui-classes";
import {
  FIND_PAGE_ROWS,
  WORD_RANK_COLUMNS,
  type FindResult,
  type FindRow,
} from "./find-results";
import { googleMapsPlaceHref } from "./single-place-lookup";

export type RowNote = { state: BatchRowState; text: string };

const HEAD_ROW =
  "text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase";
const ROW_DIVIDERS =
  "[&>td]:border-border/60 [&>td]:border-t [&>th]:border-border/60 [&>th]:border-t";
/** The thin line between column groups. */
const GROUP_EDGE = "border-border border-l";
/** On and Place stay put from `sm`. This table is wider than the pane at
 *  every breakpoint, so the shared sticky classes (which let go at `sm`)
 *  would unpin the name. On is a fixed 9rem and hides below `sm`; Place
 *  starts where it ends, and at the left edge on a phone. */
const PIN_HEAD_BG =
  "z-20 bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))]";
const PIN_CELL_BG = "z-10 bg-card";
const PIN_HELD_HEAD = `hidden sticky left-0 w-36 min-w-36 max-w-36 sm:table-cell ${PIN_HEAD_BG}`;
const PIN_PLACE_HEAD = `sticky left-0 sm:left-36 ${PIN_HEAD_BG}`;
const PIN_HELD_CELL = `hidden sticky left-0 w-36 min-w-36 max-w-36 sm:table-cell ${PIN_CELL_BG}`;
const PIN_PLACE_CELL = `sticky left-0 sm:left-36 ${PIN_CELL_BG}`;

export const rowNameId = (i: number) => `find-row-name-${i}`;

const NO_IDS: ReadonlySet<string> = new Set();
const NO_ERRORS: Readonly<Record<string, string>> = {};

/** Idle, the click is awaiting the server, or a run is already generating. */
function enrichPhase(
  row: FindRow,
  startingIds: ReadonlySet<string>,
  enrichingIds: ReadonlySet<string>,
): "idle" | "starting" | "enriching" {
  const id = row.mesitaId;
  if (!id) return "idle";
  if (startingIds.has(id)) return "starting";
  if (enrichingIds.has(id) || row.placeHit?.enriching === true) return "enriching";
  return "idle";
}

export function FindResults({
  query,
  result,
  added,
  notes,
  disabled,
  onOpen,
  onOpenGoogle,
  onAdd,
  onEnrich,
  startingIds = NO_IDS,
  enrichingIds = NO_IDS,
  enrichErrors = NO_ERRORS,
  variant = "search",
}: {
  query: string;
  result: FindResult;
  /** This page's Adds: Google Place ID → Mesita id. */
  added: ReadonlyMap<string, string>;
  notes: Readonly<Record<string, RowNote>>;
  disabled: boolean;
  onOpen: (row: FindRow) => void;
  /** Set when Creation › Create-on-open (admin app) is on: a Google-only
   *  row's name creates the place and opens it (MESITA-2298). Unset, the
   *  name links to Google Maps and only the Create button mints. */
  onOpenGoogle?: (row: FindRow) => void;
  onAdd: (row: FindRow) => void;
  onEnrich?: (row: FindRow, depth: EnrichDepth) => void;
  /** Mesita ids whose Enrich click has not been accepted yet. */
  startingIds?: ReadonlySet<string>;
  /** Mesita ids this page has started, on top of `placeHit.enriching`. */
  enrichingIds?: ReadonlySet<string>;
  /** Mesita id → the last Enrich error. Cleared while a new click is in flight. */
  enrichErrors?: Readonly<Record<string, string>>;
  /** `catalogue` is the empty search: Mesita places only, no rank columns. */
  variant?: "search" | "catalogue";
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const rows = result.rows.map((row) => withAdd(row, added));
  const pages = Math.max(1, Math.ceil(rows.length / FIND_PAGE_ROWS));
  // A new result can be shorter than the page we were on.
  const page = Math.min(pageIndex, pages - 1);
  const first = page * FIND_PAGE_ROWS;
  const shown = rows.slice(first, first + FIND_PAGE_ROWS);
  const failed = new Set(result.failed);
  const ranks = variant === "search";
  const colSpan =
    3 + GENERAL_STATE_FACTS.length + (ranks ? WORD_RANK_COLUMNS.length : 0);

  if (rows.length === 0) {
    const allFailed = ranks && WORD_RANK_COLUMNS.every((s) => failed.has(s.key));
    return (
      <div className="mt-5">
        {allFailed ? null : ranks ? (
          <>
            <p className="text-sm">Nothing on Mesita or Google matches “{query}”.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Paste its Google Place ID (ChIJ…) to look it up directly.
            </p>
          </>
        ) : (
          <p className="text-sm">
            Mesita has no places yet. Paste a Google Place ID (ChIJ…) to create the first.
          </p>
        )}
        <NoteLines notes={result.notes} />
      </div>
    );
  }

  return (
    <>
      <div className="border-border bg-card -mx-5 mt-5 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border">
        <div className="overflow-x-auto">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <caption className="sr-only">
              {ranks
                ? `Places matching “${query}”, with their states, and where Name Search and Google ranked them`
                : "Every place on Mesita, with its states"}
            </caption>
            <thead>
              <tr className={HEAD_ROW}>
                <th
                                    scope="col"
                  className={`px-3 py-3 text-center align-bottom font-semibold ${PIN_HELD_HEAD}`}
                >
                  On
                </th>
                <th
                                    scope="col"
                  className={`px-4 py-3 align-bottom font-semibold ${PIN_PLACE_HEAD}`}
                >
                  Place
                </th>
                {GENERAL_STATE_FACTS.map((f) => (
                  <th
                    key={f.key}
                    scope="col"
                    className="px-3 py-3 text-center align-bottom font-semibold whitespace-nowrap"
                  >
                    {f.label}
                  </th>
                ))}
                {ranks
                  ? WORD_RANK_COLUMNS.map((s, i) => (
                      <th
                        key={s.key}
                                                scope="col"
                        className={
                          "hidden px-3 py-3 text-center align-bottom font-semibold whitespace-nowrap sm:table-cell " +
                          (i === 0 ? GROUP_EDGE : "")
                        }
                      >
                        {s.label}
                        {failed.has(s.key) ? (
                          <span title={`${s.long} failed`} className="text-destructive ml-1 inline-flex align-[-2px]">
                            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                            <span className="sr-only">{s.long} failed</span>
                          </span>
                        ) : null}
                      </th>
                    ))
                  : null}
                <th scope="col" className="px-4 py-3">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={row.key} className={ROW_DIVIDERS}>
                  <td className={`px-3 py-3 text-center align-top ${PIN_HELD_CELL}`}>
                    <HeldCell row={row} />
                  </td>
                  <th
                    scope="row"
                    className={`max-w-[60vw] px-4 py-3 text-left align-top font-normal sm:max-w-[280px] ${PIN_PLACE_CELL}`}
                  >
                    <span className="mb-1 inline-flex sm:hidden">
                      <HeldCell row={row} />
                    </span>
                    <NameCell
                      row={row}
                      id={rowNameId(first + i)}
                      disabled={disabled}
                      onOpen={onOpen}
                      onOpenGoogle={onOpenGoogle}
                    />
                    {row.address ? (
                      <span className="text-muted-foreground block truncate type-label">
                        {row.address}
                      </span>
                    ) : null}
                    {ranks ? <PhoneSources row={row} /> : null}
                  </th>
                  <ProfileCells
                    row={row}
                    enrichingNow={enrichPhase(row, startingIds, enrichingIds) !== "idle"}
                  />
                  {ranks
                    ? WORD_RANK_COLUMNS.map((s, i) => (
                        <td
                          key={s.key}
                          className={
                            "hidden px-3 py-3 text-center align-top sm:table-cell " +
                            (i === 0 ? GROUP_EDGE : "")
                          }
                        >
                          <SourceCell
                            rank={row.ranks[s.key]}
                            source={s.long}
                            failed={failed.has(s.key)}
                          />
                        </td>
                      ))
                    : null}
                  <td className="px-4 py-3 text-right align-top">
                    <ActionCell
                      row={row}
                      note={row.googleId ? notes[row.googleId] : undefined}
                      phase={enrichPhase(row, startingIds, enrichingIds)}
                      enrichError={row.mesitaId ? enrichErrors[row.mesitaId] : undefined}
                      disabled={disabled}
                      onOpen={onOpen}
                      onAdd={onAdd}
                      onEnrich={onEnrich}
                    />
                  </td>
                </tr>
              ))}
              {pages > 1 ? (
                <tr className={ROW_DIVIDERS}>
                  <td colSpan={colSpan} className="px-4 py-2">
                    <Pager
                      page={page}
                      pages={pages}
                      first={first}
                      count={shown.length}
                      total={rows.length}
                      onPage={(next) => {
                        setPageIndex(next);
                        // The new page's first row takes focus once it exists.
                        requestAnimationFrame(() =>
                          document.getElementById(rowNameId(next * FIND_PAGE_ROWS))?.focus(),
                        );
                      }}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
      <NoteLines notes={result.notes} />
    </>
  );
}

/** Previous · "51–100 of 240" · Next, under the last row. */
function Pager({
  page,
  pages,
  first,
  count,
  total,
  onPage,
}: {
  page: number;
  pages: number;
  first: number;
  count: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const button = `text-muted-foreground hover:text-foreground disabled:text-muted-foreground/40 type-label font-semibold transition disabled:cursor-not-allowed ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;
  return (
    <nav aria-label="Pages" className="flex items-center gap-4">
      <button
        type="button"
        disabled={page === 0}
        onClick={() => onPage(page - 1)}
        className={button}
      >
        Previous
      </button>
      <span className="text-muted-foreground type-label tabular-nums">
        {first + 1}–{first + count} of {total}
      </span>
      <button
        type="button"
        disabled={page >= pages - 1}
        onClick={() => onPage(page + 1)}
        className={button}
      >
        Next
      </button>
    </nav>
  );
}

/** First column. Green when Mesita holds the place; muted when it is
 *  Google only. Google is not a failure, so it is not rose. */
function HeldCell({ row }: { row: FindRow }) {
  if (row.held) {
    return (
      <span className="inline-flex items-center justify-center rounded-full bg-green-500/10 px-2 py-0.5 type-label font-semibold whitespace-nowrap text-green-700">
        Mesita
      </span>
    );
  }
  return (
    <span className="text-muted-foreground bg-muted inline-flex items-center justify-center rounded-full px-2 py-0.5 type-label font-semibold whitespace-nowrap">
      Google only
    </span>
  );
}

/** A row this page just created is Mesita's now, whatever the sources said. */
function withAdd(row: FindRow, added: ReadonlyMap<string, string>): FindRow {
  const id = row.googleId ? added.get(row.googleId) : undefined;
  return id ? { ...row, held: true, mesitaId: id } : row;
}

function NameCell({
  row,
  id,
  disabled,
  onOpen,
  onOpenGoogle,
}: {
  row: FindRow;
  id: string;
  disabled: boolean;
  onOpen: (row: FindRow) => void;
  onOpenGoogle?: (row: FindRow) => void;
}) {
  const name =
    "block truncate font-medium underline underline-offset-4 text-(--brand-pink-text) decoration-(--brand-pink-text) visited:text-(--brand-pink-900) visited:decoration-(--brand-pink-900) " +
    FOCUS_RING_CLASS;
  if (row.held && row.mesitaId) {
    return (
      <Link id={id} href={placeTabHref(row.mesitaId, "profile")} className={name}>
        {row.name}
      </Link>
    );
  }
  if (row.held) {
    // Held per Text Search's join, id unknown: opening takes the identity lookup.
    return (
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => onOpen(row)}
        className={`${name} max-w-full text-left disabled:opacity-60`}
      >
        {row.name}
      </button>
    );
  }
  if (row.googleId && onOpenGoogle) {
    // Create on open (MESITA-2298): the name mints the place and opens it.
    return (
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => onOpenGoogle(row)}
        aria-label={`Open ${row.name} on Mesita`}
        className={`${name} max-w-full text-left disabled:opacity-60`}
      >
        {row.name}
      </button>
    );
  }
  if (row.googleId) {
    return (
      <a
        id={id}
        href={googleMapsPlaceHref(row.googleId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${row.name}, opens Google Maps in a new tab`}
        className={`${name} inline-flex max-w-full items-center gap-1`}
      >
        <span className="truncate">{row.name}</span>
        <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0" aria-hidden="true" />
      </a>
    );
  }
  return (
    <span id={id} tabIndex={-1} className="block truncate font-medium">
      {row.name}
    </span>
  );
}

function SourceCell({
  rank,
  source,
  failed,
}: {
  rank: number | null;
  source: string;
  failed: boolean;
}) {
  if (rank != null) {
    return (
      <>
        <span aria-hidden="true" className="text-foreground type-label font-semibold tabular-nums">
          #{rank}
        </span>
        <span className="sr-only">
          {source}: rank {rank}
        </span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden="true" className="text-muted-foreground">
        —
      </span>
      <span className="sr-only">{failed ? `${source} failed` : `Not found by ${source}`}</span>
    </>
  );
}

const CELL = "px-3 py-3 text-center align-top whitespace-nowrap";

function ProfileCells({ row, enrichingNow }: { row: FindRow; enrichingNow: boolean }) {
  const hit = row.placeHit;
  return (
    <>
      {GENERAL_STATE_FACTS.map((f) => (
        <td key={f.key} className={CELL}>
          {f.key === "enriching" && enrichingNow ? (
            <StatePill
              on={true}
              falseTone={STATE_FACT_FALSE_TONE[f.key]}
              badWhenTrue={BAD_WHEN_TRUE.has(f.key)}
            />
          ) : hit ? (
            f.key === "requested" ? (
              <span
                className={
                  "type-label font-semibold tabular-nums " +
                  (hit.request_count > 0 ? "text-foreground" : "text-muted-foreground")
                }
              >
                {hit.request_count}
                <span className="sr-only">
                  {" "}
                  request{hit.request_count === 1 ? "" : "s"}
                </span>
              </span>
            ) : (
              <StatePill
                on={factOn(hit, f.key)}
                falseTone={STATE_FACT_FALSE_TONE[f.key]}
                badWhenTrue={BAD_WHEN_TRUE.has(f.key)}
              />
            )
          ) : row.held ? (
            <StatePill on="unknown" />
          ) : (
            <Miss label={f.label} />
          )}
        </td>
      ))}
    </>
  );
}

function Miss({ label }: { label: string }) {
  return (
    <>
      <span aria-hidden="true" className="text-muted-foreground">
        —
      </span>
      <span className="sr-only">{label}: not on Mesita</span>
    </>
  );
}

/** Name Search and Google, folded into one line for a phone. Misses are omitted. */
function PhoneSources({ row }: { row: FindRow }) {
  const parts = WORD_RANK_COLUMNS.flatMap((s) =>
    row.ranks[s.key] != null ? [`${s.short} #${row.ranks[s.key]}`] : [],
  );
  if (parts.length === 0) return null;
  return (
    <span className="text-muted-foreground mt-1 block type-label tabular-nums sm:hidden">
      {parts.join(" · ")}
    </span>
  );
}

function ActionCell({
  row,
  note,
  phase,
  enrichError,
  disabled,
  onOpen,
  onAdd,
  onEnrich,
}: {
  row: FindRow;
  note: RowNote | undefined;
  phase: "idle" | "starting" | "enriching";
  enrichError: string | undefined;
  disabled: boolean;
  onOpen: (row: FindRow) => void;
  onAdd: (row: FindRow) => void;
  onEnrich?: (row: FindRow, depth: EnrichDepth) => void;
}) {
  const adding = note?.state === "running";
  return (
    <div className="flex flex-col items-end gap-1.5">
      {row.held ? (
        /* decision: Pato (2026-10-17, MESITA-2320) — Open · Weak Enrich ·
           Strong Enrich sit on one line, one pill style. */
        <span className="inline-flex flex-nowrap items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => onOpen(row)}
            disabled={disabled}
            aria-label={`Open ${row.name}`}
            className={`${PILL_BUTTON_CLASS} whitespace-nowrap`}
          >
            Open
          </button>
          {row.mesitaId ? (
            phase === "idle" ? (
              ENRICH_ACTIONS.map((action) => (
                <button
                  key={action.depth}
                  type="button"
                  onClick={() => onEnrich?.(row, action.depth)}
                  disabled={disabled}
                  title={action.title}
                  aria-label={`${action.label} ${row.name}`}
                  className={`${PILL_BUTTON_CLASS} whitespace-nowrap`}
                >
                  {action.label}
                </button>
              ))
            ) : (
              <button
                type="button"
                disabled
                aria-busy="true"
                aria-label={phase === "starting" ? `Starting ${row.name}` : `Enriching ${row.name}`}
                className={`${PILL_BUTTON_CLASS} whitespace-nowrap`}
              >
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                {phase === "starting" ? "Starting…" : "Enriching"}
              </button>
            )
          ) : null}
        </span>
      ) : row.googleId ? (
        <button
          type="button"
          onClick={() => onAdd(row)}
          disabled={disabled || adding}
          aria-label={`Create ${row.name} on Mesita`}
          className={`${PILL_BUTTON_CLASS} whitespace-nowrap`}
        >
          {adding ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="h-3 w-3" aria-hidden="true" />
          )}
          {adding ? "Creating…" : "Create"}
        </button>
      ) : null}
      <span aria-live="polite" className="max-w-56">
        {phase === "idle" && enrichError ? (
          <span className="inline-flex items-center gap-1.5 text-left type-label text-destructive">
            <StateIcon state="error" />
            <span>{enrichError}</span>
          </span>
        ) : null}
        {note && note.state !== "running" ? (
          <span
            className={
              "inline-flex items-center gap-1.5 text-left type-label " +
              (note.state === "error" ? "text-destructive" : "text-muted-foreground")
            }
          >
            <StateIcon state={note.state} />
            <span>{note.text}</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}

function NoteLines({ notes }: { notes: FindResult["notes"] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1">
      {notes.map((n) => (
        <li
          key={n.text}
          className={"type-label " + (n.tone === "error" ? "text-destructive" : "text-muted-foreground")}
        >
          {n.text}
        </li>
      ))}
    </ul>
  );
}
