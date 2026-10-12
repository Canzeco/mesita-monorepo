"use client";

// Single Place › Find › the one results table (MESITA-2124). A row per
// place any source returned; MESITA (Catalogue · Name Search) | GOOGLE
// (Autocomplete · Text Search) columns say where each source ranked it; the
// action sits at the row end. Drawn once every source has settled, so no row
// ever moves under the cursor. Skeleton and classes are Multiple Places ›
// Mesita Search's table (MesitaSearchResults.tsx).
//
// Under 640px the four source columns fold into one line beneath the
// address, so the name, its sources and its action all fit without a
// sideways scroll.

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ChevronRight, ExternalLink, Loader2, Plus } from "lucide-react";
import type { PlaceHit } from "@/app/(app)/manage-multiple/actions";
import { StatePill } from "@/app/(app)/manage-multiple/PlaceFacts";
import { factOn } from "@/app/(app)/manage-multiple/mesita-search-facts";
import { StateIcon, type BatchRowState } from "@/app/(app)/manage-multiple/StateIcon";
import { placeTabHref } from "@/lib/place-tabs";
import {
  BAD_WHEN_TRUE,
  GENERAL_STATE_FACTS,
  STATE_FACT_FALSE_TONE,
} from "@/lib/state-vocabulary";
import {
  FOCUS_RING_CLASS,
  PILL_BUTTON_CLASS,
  STICKY_COL_CELL,
  STICKY_COL_HEAD,
  TOUCH_TARGET_CLASS,
} from "@/lib/ui-classes";
import {
  FIND_FIRST_ROWS,
  FIND_SOURCES,
  ratingLabel,
  type FindResult,
  type FindRow,
} from "./find-results";
import { googleMapsPlaceHref } from "./single-place-lookup";

export type RowNote = { state: BatchRowState; text: string };

const HEAD_ROW =
  "text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase";
const ROW_DIVIDERS =
  "[&>td]:border-border/60 [&>td]:border-t [&>th]:border-border/60 [&>th]:border-t";
/** The thin line between the MESITA and GOOGLE groups. */
const GROUP_EDGE = "border-border border-l";

export const rowNameId = (i: number) => `find-row-name-${i}`;

export function FindResults({
  query,
  result,
  added,
  notes,
  disabled,
  onOpen,
  onAdd,
}: {
  query: string;
  result: FindResult;
  /** This page's Adds: Google Place ID → Mesita id. */
  added: ReadonlyMap<string, string>;
  notes: Readonly<Record<string, RowNote>>;
  disabled: boolean;
  onOpen: (row: FindRow) => void;
  onAdd: (row: FindRow) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const rows = result.rows.map((row) => withAdd(row, added));
  const shown = expanded ? rows : rows.slice(0, FIND_FIRST_ROWS);
  const more = rows.length - shown.length;
  const failed = new Set(result.failed);

  if (rows.length === 0) {
    const allFailed = failed.size === FIND_SOURCES.length;
    return (
      <div className="mt-5">
        {allFailed ? null : (
          <>
            <p className="text-sm">Nothing on Mesita or Google matches “{query}”.</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Paste its Google Place ID (ChIJ…) to look it up directly.
            </p>
          </>
        )}
        <NoteLines notes={result.notes} />
      </div>
    );
  }

  return (
    <>
      <div className="border-border bg-card -mx-5 mt-5 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm sm:min-w-[720px]">
            <caption className="sr-only">
              Places matching “{query}”, with the rank each source gave them
            </caption>
            <thead>
              <tr className={HEAD_ROW}>
                <th
                  rowSpan={2}
                  scope="col"
                  className={`px-4 py-3 align-bottom font-semibold ${STICKY_COL_HEAD}`}
                >
                  Place
                </th>
                <th
                  colSpan={2}
                  scope="colgroup"
                  className="hidden px-3 pt-3 pb-1 text-center font-semibold sm:table-cell"
                >
                  Mesita
                </th>
                <th
                  colSpan={2}
                  scope="colgroup"
                  className={`hidden px-3 pt-3 pb-1 text-center font-semibold sm:table-cell ${GROUP_EDGE}`}
                >
                  Google
                </th>
                <th rowSpan={2} scope="col" className="px-4 py-3">
                  <span className="sr-only">Action</span>
                </th>
              </tr>
              <tr className={HEAD_ROW}>
                {FIND_SOURCES.map((s) => (
                  <th
                    key={s.key}
                    scope="col"
                    className={
                      "hidden px-3 pb-3 text-center font-semibold whitespace-nowrap sm:table-cell " +
                      (s.key === "autocomplete" ? GROUP_EDGE : "")
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
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => (
                <tr key={row.key} className={ROW_DIVIDERS}>
                  <th
                    scope="row"
                    className={`max-w-[60vw] px-4 py-3 text-left align-top font-normal sm:max-w-[320px] ${STICKY_COL_CELL}`}
                  >
                    <NameCell row={row} id={rowNameId(i)} disabled={disabled} onOpen={onOpen} />
                    {row.address ? (
                      <span className="text-muted-foreground block truncate type-label">
                        {row.address}
                      </span>
                    ) : null}
                    {ratingLabel(row) ? (
                      <span className="text-muted-foreground block type-label tabular-nums">
                        {ratingLabel(row)}
                      </span>
                    ) : null}
                    {row.placeHit ? <PlaceStateFacts hit={row.placeHit} /> : null}
                    <PhoneSources row={row} />
                  </th>
                  {FIND_SOURCES.map((s) => (
                    <td
                      key={s.key}
                      className={
                        "hidden px-3 py-3 text-center align-top sm:table-cell " +
                        (s.key === "autocomplete" ? GROUP_EDGE : "")
                      }
                    >
                      <SourceCell
                        rank={row.ranks[s.key]}
                        source={s.long}
                        failed={failed.has(s.key)}
                      />
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right align-top">
                    <ActionCell
                      row={row}
                      note={row.googleId ? notes[row.googleId] : undefined}
                      disabled={disabled}
                      onOpen={onOpen}
                      onAdd={onAdd}
                    />
                  </td>
                </tr>
              ))}
              {more > 0 ? (
                <tr className={ROW_DIVIDERS}>
                  <td colSpan={6} className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => {
                        setExpanded(true);
                        // The first newly shown row takes focus once it exists.
                        requestAnimationFrame(() =>
                          document.getElementById(rowNameId(FIND_FIRST_ROWS))?.focus(),
                        );
                      }}
                      className={`text-muted-foreground hover:text-foreground type-label font-semibold transition ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`}
                    >
                      Show {more} more
                    </button>
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
}: {
  row: FindRow;
  id: string;
  disabled: boolean;
  onOpen: (row: FindRow) => void;
}) {
  const name = "block truncate font-medium underline-offset-4 hover:underline " + FOCUS_RING_CLASS;
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

/** The six place states when the catalogue row is known — same facts as
 *  Mesita Search, laid out for the Place column. */
function PlaceStateFacts({ hit }: { hit: PlaceHit }) {
  return (
    <dl className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-1">
      {GENERAL_STATE_FACTS.map((f) => (
        <div key={f.key} className="flex items-center gap-1">
          <dt className="text-muted-foreground type-label">{f.label}</dt>
          <dd className="m-0">
            {f.key === "requested" ? (
              <span
                className={
                  "type-label font-semibold tabular-nums " +
                  (hit.request_count > 0 ? "text-foreground" : "text-muted-foreground")
                }
              >
                {hit.request_count}
              </span>
            ) : (
              <StatePill
                on={factOn(hit, f.key)}
                falseTone={STATE_FACT_FALSE_TONE[f.key]}
                badWhenTrue={BAD_WHEN_TRUE.has(f.key)}
              />
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The four columns, folded into one line for a phone. Misses are omitted. */
function PhoneSources({ row }: { row: FindRow }) {
  const parts = FIND_SOURCES.flatMap((s) =>
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
  disabled,
  onOpen,
  onAdd,
}: {
  row: FindRow;
  note: RowNote | undefined;
  disabled: boolean;
  onOpen: (row: FindRow) => void;
  onAdd: (row: FindRow) => void;
}) {
  const adding = note?.state === "running";
  return (
    <div className="flex flex-col items-end gap-1.5">
      {row.held ? (
        <button
          type="button"
          onClick={() => onOpen(row)}
          disabled={disabled}
          aria-label={`Open ${row.name}`}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1 type-label font-semibold whitespace-nowrap text-green-700 disabled:opacity-60 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`}
        >
          On Mesita
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
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
