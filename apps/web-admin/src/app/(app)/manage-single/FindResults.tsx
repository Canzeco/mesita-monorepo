"use client";

// Single Place › Find › the one results table (MESITA-2124, MESITA-2181,
// MESITA-2187, MESITA-2188). A row per place. The first column says whether
// Mesita holds it or it is Google only — the first fact to read. Then the
// states (Premier is a tier: Off · 2X · 5X, MESITA-2925), then Views · Likes,
// then, on a word, Google's rank. 50 rows a page
// (MESITA-2335); no group header over the states.
// Reviews stay off this table (MESITA-2222). The action sits at the row end.
// Drawn once both have settled, so no row ever moves under the cursor.
//
// From 640px, On and Place stay pinned while the state columns scroll.
// Under that, On hides and the same pill sits in the Place cell: a second
// 9rem pin plus Place at 60vw would fill the phone. The rank folds into
// one line beneath the address.

import { Fragment, useState } from "react";
import { AlertTriangle, ExternalLink, Plus } from "lucide-react";
import { StatePill } from "@/app/(app)/manage-multiple/PlaceFacts";
import { factOn } from "@/app/(app)/manage-multiple/mesita-search-facts";
import { StateIcon, type BatchRowState } from "@/app/(app)/manage-multiple/StateIcon";
import { PlaceStateCells, PlaceStateHeads } from "@/app/(app)/manage-multiple/PlaceStateCells";
import { PLACE_STATE_ROWS } from "@mesita/place-profile/lib/place-states";
import { businessPlaceHref } from "@/lib/business-url";
import { PlaceDoor } from "@/components/PlaceDoor";
import {
  BAD_WHEN_TRUE,
  premierTierChip,
  GENERAL_STATE_FACTS,
  STATE_FACT_FALSE_TONE,
} from "@/lib/state-vocabulary";
import {
  Button,
  Chip,
  FOCUS_RING_CLASS,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin-ui";
import {
  FIND_PAGE_ROWS,
  WORD_RANK_COLUMNS,
  type FindResult,
  type FindRow,
} from "./find-results";
import { googleMapsPlaceHref } from "./single-place-lookup";

export type RowNote = { state: BatchRowState; text: string };

/** The thin line between column groups. */
const GROUP_EDGE = "border-border border-l";
/** The kit's head and cell look, for the Place States columns, which
 *  PlaceStateHeads/PlaceStateCells draw as their own th/td. */
const STATE_HEAD = "text-muted-foreground h-10 px-3 text-left align-middle type-label font-semibold whitespace-nowrap";
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

/** The table's card: bled to the pane's edges on a phone, a rounded card
 *  from 640px. */
const FIND_TABLE_FRAME =
  "border-border bg-card -mx-5 mt-5 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border";

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
  onEnrich?: (row: FindRow) => void;
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
    3 + GENERAL_STATE_FACTS.length + 1 + PLACE_STATE_ROWS.length + QUICK_STATS.length +
    (ranks ? WORD_RANK_COLUMNS.length : 0);

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
      <div className={FIND_TABLE_FRAME}>
        <Table>
          <caption className="sr-only">
            {ranks
              ? `Places matching “${query}”, with their states, and where Google ranked them`
              : "Every place on Mesita, with its states"}
          </caption>
          <THead>
            <Tr>
              <Th scope="col" className={PIN_HELD_HEAD}>
                On
              </Th>
              <Th scope="col" className={PIN_PLACE_HEAD}>
                Place
              </Th>
              {GENERAL_STATE_FACTS.map((f) => (
                <Fragment key={f.key}>
                  <Th scope="col">{f.label}</Th>
                  {f.key === "enriched" ? <Th scope="col">Premier</Th> : null}
                </Fragment>
              ))}
              {/* Place States (Main §10, MESITA-3595): what the business
                  decides, the same twelve Business › Admin prints. */}
              <PlaceStateHeads className={STATE_HEAD} edgeClassName={GROUP_EDGE} />
              {QUICK_STATS.map((q, i) => (
                <Th key={q.key} scope="col" numeric className={i === 0 ? GROUP_EDGE : undefined}>
                  {q.label}
                </Th>
              ))}
              {ranks
                ? WORD_RANK_COLUMNS.map((s, i) => (
                    <Th
                      key={s.key}
                      scope="col"
                      className={"hidden sm:table-cell " + (i === 0 ? GROUP_EDGE : "")}
                    >
                      {s.label}
                      {failed.has(s.key) ? (
                        <span title={`${s.long} failed`} className="text-destructive ml-1 inline-flex align-[-2px]">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          <span className="sr-only">{s.long} failed</span>
                        </span>
                      ) : null}
                    </Th>
                  ))
                : null}
              <Th scope="col">
                <span className="sr-only">Action</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {shown.map((row, i) => (
              <Tr key={row.key}>
                <Td className={PIN_HELD_CELL}>
                  <HeldCell row={row} />
                </Td>
                <Th scope="row" className={`max-w-[60vw] sm:max-w-[280px] ${PIN_PLACE_CELL}`}>
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
                    <span className="text-muted-foreground block truncate type-label font-normal">
                      {row.address}
                    </span>
                  ) : null}
                  {ranks ? <PhoneSources row={row} /> : null}
                </Th>
                <ProfileCells
                  row={row}
                  enrichingNow={enrichPhase(row, startingIds, enrichingIds) !== "idle"}
                />
                {ranks
                  ? WORD_RANK_COLUMNS.map((s, i) => (
                      <Td
                        key={s.key}
                        className={"hidden whitespace-nowrap sm:table-cell " + (i === 0 ? GROUP_EDGE : "")}
                      >
                        <SourceCell
                          rank={row.ranks[s.key]}
                          source={s.long}
                          failed={failed.has(s.key)}
                        />
                      </Td>
                    ))
                  : null}
                <Td className="text-right">
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
                </Td>
              </Tr>
            ))}
            {pages > 1 ? (
              <Tr>
                <Td colSpan={colSpan}>
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
                </Td>
              </Tr>
            ) : null}
          </TBody>
        </Table>
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
  return (
    <nav aria-label="Pages" className="flex items-center gap-4">
      <Button tone="ghost" size="sm" disabled={page === 0} onClick={() => onPage(page - 1)}>
        Previous
      </Button>
      <span className="text-muted-foreground type-label tabular-nums">
        {first + 1}–{first + count} of {total}
      </span>
      <Button tone="ghost" size="sm" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>
        Next
      </Button>
    </nav>
  );
}

/** First column. Green when Mesita holds the place; muted when it is
 *  Google only. Google is not a failure, so it is not rose. */
function HeldCell({ row }: { row: FindRow }) {
  return row.held ? <Chip tone="success">Mesita</Chip> : <Chip>Google only</Chip>;
}

/** A row this page just created is Mesita's now, whatever the sources said. */
function withAdd(row: FindRow, added: ReadonlyMap<string, string>): FindRow {
  const id = row.googleId ? added.get(row.googleId) : undefined;
  return id ? { ...row, held: true, mesitaId: id } : row;
}

/** A name that is a button, not a link (no id yet, or Create on open):
 *  the kit's quiet button, pulled back to the column's edge. */
const NAME_BUTTON = "-ml-3 max-w-full";

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
      <PlaceDoor id={id} href={businessPlaceHref(row.mesitaId, "admin")} className={name}>
        {row.name}
      </PlaceDoor>
    );
  }
  if (row.held) {
    // Held per Text Search's join, id unknown: opening takes the identity lookup.
    return (
      <Button
        id={id}
        tone="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => onOpen(row)}
        className={NAME_BUTTON}
      >
        <span className="min-w-0 truncate">{row.name}</span>
      </Button>
    );
  }
  if (row.googleId && onOpenGoogle) {
    // Create on open (MESITA-2298): the name mints the place and opens it.
    return (
      <Button
        id={id}
        tone="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => onOpenGoogle(row)}
        aria-label={`Open ${row.name} on Mesita`}
        className={NAME_BUTTON}
      >
        <span className="min-w-0 truncate">{row.name}</span>
      </Button>
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
    <span id={id} tabIndex={-1} className="text-foreground block truncate font-medium">
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

/** Place States cells: the kit's cell look (PlaceStateCells draws its own td). */
const STATE_CELL = "px-3 py-2.5 align-middle whitespace-nowrap";

function ProfileCells({ row, enrichingNow }: { row: FindRow; enrichingNow: boolean }) {
  const hit = row.placeHit;
  return (
    <>
      {GENERAL_STATE_FACTS.map((f) => (
        <Fragment key={f.key}>
          <Td className="whitespace-nowrap">
            {f.key === "enriching" && enrichingNow ? (
              <StatePill
                on={true}
                falseTone={STATE_FACT_FALSE_TONE[f.key]}
                badWhenTrue={BAD_WHEN_TRUE.has(f.key)}
              />
            ) : hit ? (
              <StatePill
                on={factOn(hit, f.key)}
                falseTone={STATE_FACT_FALSE_TONE[f.key]}
                badWhenTrue={BAD_WHEN_TRUE.has(f.key)}
              />
            ) : row.held ? (
              <StatePill on="unknown" />
            ) : (
              <Miss label={f.label} />
            )}
          </Td>
          {f.key === "enriched" ? (
            <Td className="whitespace-nowrap">
              {hit ? (
                <PremierPill tier={hit.boost_tier} />
              ) : row.held ? (
                <StatePill on="unknown" />
              ) : (
                <Miss label="Premier" />
              )}
            </Td>
          ) : null}
        </Fragment>
      ))}
      <PlaceStateCells
        hit={hit}
        className={STATE_CELL}
        edgeClassName={GROUP_EDGE}
        empty={(label) => (row.held ? <StatePill on="unknown" /> : <Miss label={label} />)}
      />
      {QUICK_STATS.map((q, i) => (
        <Td key={q.key} numeric className={`whitespace-nowrap ${i === 0 ? GROUP_EDGE : ""}`}>
          {hit ? (
            <StatCount value={hit[q.key]} label={q.label} />
          ) : row.held ? (
            <StatePill on="unknown" />
          ) : (
            <Miss label={q.label} />
          )}
        </Td>
      ))}
    </>
  );
}

/** Views · Likes (MESITA-2809): unique members who viewed / liked (saved)
 *  the place — the quick stats beside the states. Wire key `saved` is Likes. */
const QUICK_STATS = [
  { key: "viewed", label: "Views" },
  { key: "saved", label: "Likes" },
] as const;

/** Premier is a tier, not a yes/no (MESITA-2925, was Boost — MESITA-2809):
 *  Off · 2X · 5X. Off is the normal case, so it is muted rather than
 *  rose; a paid tier is green. */
function PremierPill({ tier }: { tier: number | null | undefined }) {
  const chip = premierTierChip(tier);
  if (chip === "?") return <StatePill on="unknown" />;
  return <Chip tone={tier ? "success" : "neutral"}>{chip}</Chip>;
}

function StatCount({ value, label }: { value: number | null | undefined; label: string }) {
  if (value == null) return <StatePill on="unknown" />;
  return (
    <span className="type-label font-semibold" aria-label={`${label}: ${value}`}>
      {value}
    </span>
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

/** Google's rank, folded into one line for a phone. A miss is omitted. */
function PhoneSources({ row }: { row: FindRow }) {
  const parts = WORD_RANK_COLUMNS.flatMap((s) =>
    row.ranks[s.key] != null ? [`${s.short} #${row.ranks[s.key]}`] : [],
  );
  if (parts.length === 0) return null;
  return (
    <span className="text-muted-foreground mt-1 block type-label font-normal tabular-nums sm:hidden">
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
  onEnrich?: (row: FindRow) => void;
}) {
  const adding = note?.state === "running";
  return (
    <div className="flex flex-col items-end gap-1.5">
      {row.held ? (
        /* decision: Pato (2026-10-17, MESITA-2320) — Open · Enrich on one line, one pill style. */
        <span className="inline-flex flex-nowrap items-center justify-end gap-1.5">
          <Button tone="secondary" size="sm" onClick={() => onOpen(row)} disabled={disabled} aria-label={`Open ${row.name}`}>
            Open
          </Button>
          {row.mesitaId ? (
            phase === "idle" ? (
              <Button
                tone="secondary"
                size="sm"
                onClick={() => onEnrich?.(row)}
                disabled={disabled}
                aria-label={`Enrich ${row.name}`}
              >
                Enrich
              </Button>
            ) : (
              <Button
                tone="secondary"
                size="sm"
                pending
                aria-busy="true"
                aria-label={phase === "starting" ? `Starting ${row.name}` : `Enriching ${row.name}`}
              >
                {phase === "starting" ? "Starting…" : "Enriching"}
              </Button>
            )
          ) : null}
        </span>
      ) : row.googleId ? (
        <Button
          tone="secondary"
          size="sm"
          onClick={() => onAdd(row)}
          disabled={disabled}
          pending={adding}
          icon={<Plus className="h-3 w-3" aria-hidden="true" />}
          aria-label={`Create ${row.name} on Mesita`}
        >
          {adding ? "Creating…" : "Create"}
        </Button>
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
