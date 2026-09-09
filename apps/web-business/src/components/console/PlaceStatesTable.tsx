"use client";

// The console place list, as a MATRIX (MESITA-1608).
//
//   Rows are places. Columns are states. The left column is identity and holds
//   the image and the name — nothing else. Everything else is a state.
//
// That is Pato's rule verbatim, and it is why the address and the organization
// line are gone from the row. Dropping the org is not a loss: Owned is the
// state form of that same fact. Dropping the address IS a real loss, and it
// was raised and kept anyway — see IDENTITY below for what carries the weight
// instead.
//
// WHY A TABLE AND NOT MORE CHIPS. The old row wore a wrapped pile of chips.
// You could read one place, but you could not read one STATE down a hundred
// places — the chips sat at different x positions on every row, and a chip
// that stayed silent when false left nothing to scan past. A column is the
// whole feature.
//
// THE COST OF THAT, STATED HONESTLY. A matrix must fill every cell, so this
// reverses PlaceRow's rule 2 ("a chip renders only when it SAYS something…
// instead of wearing eight grey 'No' badges", MESITA-1562). The compensation
// is tone, not silence: rose is reserved for a false that is a debt the viewer
// can settle, and STATE_FACT_FALSE_TONE — shared with the single-place State
// box — decides which those are.
//
// NOTHING HERE COMPUTES A STATE. `generalHeaderFacts()` and
// `intakeFunctionRows()` already exist in this app and already answer these
// exact questions for the Place screen. Porting web-admin's `factOn` would
// have been a fourth mapper for one question, and its trailing `return false`
// means a fact nobody wired renders "no" forever, with total confidence.
//
// INTAKE IS BACK, BEHIND ONE TOGGLE (MESITA-1687, reversing MESITA-1637's
// "the intake states are internal"). Pato, 2026-09-08: ship the per-function
// map to every business browser again — the toggle is what keeps it out of
// sight by default, not a server-side withhold, so "internal" is now a UI
// default rather than a wire-level guarantee. `showIntake` starts `false`:
// the eleven functions answer an operator question most managers never ask,
// and a collapsed toggle keeps the matrix at its MESITA-1651 width until
// someone actually wants the detail. This file has to be a Client Component
// for that piece of state to exist at all — `renderAction` used to be a
// function called during server render; it is now `actionsByPlaceId`, a
// plain Record of already-rendered nodes, because a function cannot cross
// the server/client boundary but a rendered element can.
//
// What SURVIVES from intake regardless of the toggle is the general pair,
// Enriching and Enriched: those are facts about the PLACE, not about our
// machinery. Neither needs the map — Enriching is its own boolean and
// Enriched is the EF's `isPlaceEnriched(enriched_at)` answer, read straight
// off the row below, same as before this reversal.
//
// ONE COLUMN SET, PLUS ELEVEN WHEN ASKED. Partner and Verified still read "?"
// on a pool row — `getAuthedUser` accepts ANY bearer token and the backend is
// a singleton, so every consumer account can read that scope and the EF
// withholds those facts. This component just renders what it is given.
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { CountCell, StateCell } from "@/components/console/StateCell";
import { placeHref, withOrg } from "@/lib/console-routes";
import { placeThumbUrl } from "@/lib/place-thumb";
import { generalHeaderFacts } from "@/components/place-manage/place-header-state";
import { intakeFunctionRows } from "@/components/place-manage/sections/state-enrichment";
import {
  GENERAL_STATE_FACTS,
  INTAKE_FUNCTIONS,
  STATE_FACT_FALSE_TONE,
  intakeFunctionLabel,
  type GeneralStateKey,
} from "@/lib/state-vocabulary";
import {
  GHOST_PILL_BUTTON_CLASS,
  SHELL_BLEED,
  STATES_ACTION_CELL,
  STATES_ACTION_HEAD,
  STATES_COL_CELL,
  STATES_COL_HEAD,
  STATES_HEAD_BG,
  STATES_HEAD_STICKY,
} from "@/lib/ui-classes";
import { cn } from "@/lib/utils";
import type { ConsolePlace } from "@/lib/api/organizations";

/** The rendered thumb box, in CSS pixels. Also what placeThumbUrl doubles for
 *  the retina request. */
const THUMB_PX = 44;

/**
 * The general columns, in PATO'S order — a lifecycle read, left to right:
 * does it exist, is it trading, can a guest reach it, does anyone want it,
 * are we working on it, did we finish, is ownership proven, does an org hold
 * it, does it pay.
 *
 * `GENERAL_STATE_FACTS` carries this same order now (MESITA-1630 fixed the
 * source array to match Notion Main §11.1 — it used to put Enriched before
 * Enriching). This stays a separate, named list anyway: it's a 9-of-12
 * SUBSET (no Visit Rewards, Mesita Pay or Mesita Credits columns here), and
 * the labels still come from the constant so the two apps cannot drift on
 * wording; only the subsetting is local, and it is named here rather than
 * inlined so a test can see it is a decision.
 */
const GENERAL_COLUMN_ORDER = [
  "seeded",
  "active",
  "listed",
  "requested",
  "enriching",
  "enriched",
  "verified",
  "owned",
  "partner",
] as const satisfies readonly GeneralStateKey[];

const LABEL_BY_KEY: Record<string, string> = Object.fromEntries(
  GENERAL_STATE_FACTS.map((f) => [f.key, f.label]),
);

const GENERAL_COLUMNS = GENERAL_COLUMN_ORDER.map((key) => ({
  key,
  label: LABEL_BY_KEY[key] ?? key,
}));

/** The eleven Intake functions, 0. Seed … 10. Embedding — same keys and
 *  order the single-place Intake States box uses, so a manager who expands
 *  both never sees them disagree. */
const INTAKE_COLUMNS = INTAKE_FUNCTIONS.map((f) => ({
  key: f.key,
  label: intakeFunctionLabel(f.n, f.label),
}));

/** Sortable columns: the identity column by name, plus every general state
 *  column. Intake columns stay unsorted — an operator question, not a list
 *  order anyone asked for. */
type SortKey = "name" | GeneralStateKey;
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };
type SortableValue = string | number | boolean | "unknown";

/** One value per place, per sortable column — reuses `cellValue` for the
 *  state facts so sorting can never disagree with what the cell renders. */
function sortValueFor(place: ConsolePlace, key: SortKey): SortableValue {
  if (key === "name") return place.name.trim().toLowerCase();
  if (key === "requested") {
    return typeof place.requestCount === "number" ? place.requestCount : "unknown";
  }
  return cellValue(place, factsFor(place), key);
}

/** "unknown" sorts last regardless of direction — a fact nobody read is not
 *  meaningfully high or low, and burying it at the bottom keeps it from
 *  masquerading as the smallest value in the column. */
function compareSortable(a: SortableValue, b: SortableValue): number {
  if (a === "unknown" || b === "unknown") {
    if (a === b) return 0;
    return a === "unknown" ? 1 : -1;
  }
  if (typeof a === "string" && typeof b === "string") return a.localeCompare(b);
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1;
  }
  return (a as number) - (b as number);
}

/** One small icon, reused on every sortable header: neutral both-ways glyph
 *  when idle, a direction arrow once that column is the active sort. Clicking
 *  cycles asc → desc → off, so a column is never stuck sorted by accident. */
function SortHeaderButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${active ? `, ${dir === "asc" ? "ascending" : "descending"}` : ""}`}
      className={cn(
        "inline-flex items-center gap-1 transition",
        active
          ? "text-foreground"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
    </button>
  );
}

function PlaceThumb({ place }: { place: ConsolePlace }) {
  const src = placeThumbUrl(place.photoUrl, THUMB_PX);
  if (src) {
    // Plain <img>, the same choice PlaceGallery makes: placeThumbUrl has
    // already produced a 2x thumb of a few KB, so next/image would add a
    // second optimizer pass over a file smaller than the request to re-encode
    // it. places.photos are full-resolution originals — pointing an <img> at
    // one a hundred times is ~27MB of scroll (MESITA-1553).
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={THUMB_PX}
        height={THUMB_PX}
        loading="lazy"
        decoding="async"
        className="border-border/60 h-11 w-11 shrink-0 rounded-lg border object-cover"
      />
    );
  }
  // No photo is the ordinary case, not an error: with an empty catalog every
  // place starts here. The initial reads as a placeholder without pretending
  // to be a photograph.
  return (
    <span
      aria-hidden
      className="border-border/60 bg-muted text-muted-foreground flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-sm font-semibold"
    >
      {place.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** The facts for one row, off the SHARED readers. `generalHeaderFacts` already
 *  returns "unknown" for every absent field, which is exactly what the deploy
 *  window needs — no separate defaulting here. */
function factsFor(place: ConsolePlace) {
  const general = new Map(
    generalHeaderFacts({
      seeded: place.seeded,
      listed: place.listed,
      business_state: place.businessState,
      enriching: place.enriching,
      requestCount: place.requestCount,
      // NO meter. generalHeaderFacts would compute Enriched from it, but the
      // list ships the EF's own `isPlaceEnriched(enriched_at)` answer and
      // `cellValue` overrides with that — the row links to the Place screen,
      // so the list must agree with its DESTINATION, not with a third
      // definition. Feeding a value that is always discarded is what kept the
      // meter on the wire after MESITA-1637 took the columns away.
      partner: place.partner ?? false,
      verified: place.verified ?? "unknown",
    }).map((f) => [f.key, f]),
  );
  return general;
}

export function PlaceStatesTable({
  places,
  organizationId,
  actionsByPlaceId,
}: {
  places: ConsolePlace[];
  organizationId: string;
  /** The action cell, INJECTED as already-rendered nodes rather than a
   *  function — this component is now a Client Component (the intake toggle
   *  needs `useState`), and a function prop cannot cross the server/client
   *  boundary the way a rendered element can. The caller (a Server
   *  Component) renders each place's action JSX itself — PlaceHoldButton and
   *  friends are client components that import "use server" modules, so
   *  importing them HERE would drag next/headers into the node tests that
   *  render this table via fixtures (it is OTP-gated and the catalog is
   *  empty; renderToStaticMarkup is the only proof this screen ever gets). A
   *  missing entry collapses to nothing, same as a viewer with no
   *  claim/release rights rendered before. */
  actionsByPlaceId?: Record<string, React.ReactNode>;
}) {
  const showActions = Boolean(actionsByPlaceId);
  const [showIntake, setShowIntake] = useState(false);
  const [sort, setSort] = useState<Sort | null>(null);

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  // Frontend-only (Pato, 2026-09-09): the row count already fits in the
  // browser, so re-ordering it is a pure client concern — no server round
  // trip, no query param, nothing for the EF to know about.
  const sortedPlaces = useMemo(() => {
    if (!sort) return places;
    const withValue = places.map((place) => ({
      place,
      value: sortValueFor(place, sort.key),
    }));
    withValue.sort(
      (a, b) =>
        compareSortable(a.value, b.value) * (sort.dir === "asc" ? 1 : -1),
    );
    return withValue.map((w) => w.place);
  }, [places, sort]);

  return (
    // Full bleed on a phone so the scrollport is the whole window (~390px)
    // rather than the ~326px left inside the gutter, then the gutter is put
    // back inside. SHELL_BLEED is asserted to be the exact negative of
    // SHELL_GUTTER by shell-chrome.test.ts — admin's hardcoded `-mx-5` would
    // be off by 4px here and by 12/20px at sm/lg. `sm:mx-0` re-seats the table
    // in its card above the phone breakpoint, which SHELL_BLEED alone does not
    // do (it bleeds at every width).
    <div
      className={cn(
        "border-border bg-card overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border",
        SHELL_BLEED,
      )}
    >
      <div className="border-border/60 flex items-center justify-end border-b px-4 py-2">
        <button
          type="button"
          onClick={() => setShowIntake((v) => !v)}
          className={GHOST_PILL_BUTTON_CLASS}
          aria-expanded={showIntake}
        >
          {showIntake ? "Hide Intake states" : "Show Intake states"}
        </button>
      </div>
      {/* A focusable, named scrolling region. Without tabIndex a keyboard user
          cannot reach the right-hand columns at all — the ported admin table
          has this bug today. overscroll-x-contain stops a horizontal fling
          from chaining into the page scroll on touch. */}
      <div
        className="overflow-x-auto overscroll-x-contain"
        tabIndex={0}
        role="region"
        aria-label="Places and their states"
      >
        {/* 1180px carries identity + nine state columns + the action cell.
              Expanded, the eleven Intake columns need room of their own — this
              is the same 20-column width MESITA-1651 measured before trimming
              back down to nine, so the layout that toggle removed is exactly
              the one this toggle brings back, on request instead of always. */}
          <table
            className={cn(
              "w-full border-separate border-spacing-0 text-sm",
              showIntake ? "min-w-[2200px]" : "min-w-[1180px]",
            )}
          >
          <caption className="sr-only">
            One row per place. The left column is the place; every other column
            is a state, reading yes, no, or ? when the fact was not available.
          </caption>
          <thead className={STATES_HEAD_STICKY}>
            {/* THE GROUP ROW ONLY EXISTS BECAUSE THERE ARE TWO GROUPS
                (MESITA-1651's own rule, honored on the way back in). It was
                removed when Intake left the table because a heading spanning
                every column named nothing the column heads did not already
                say; now that a second group can be on screen, the row
                distinguishing them earns its place again — collapsed away
                with the columns it labels. */}
            {showIntake ? (
              <tr className={cn("text-muted-foreground type-label text-left font-semibold tracking-[0.12em] uppercase", STATES_HEAD_BG)}>
                <th scope="col" className={cn("px-4 py-2", STATES_COL_HEAD)} />
                <th
                  scope="col"
                  colSpan={GENERAL_COLUMNS.length}
                  className="px-3 py-2 text-center"
                >
                  General States
                </th>
                <th
                  scope="col"
                  colSpan={INTAKE_COLUMNS.length}
                  className="px-3 py-2 text-center"
                >
                  Intake States
                </th>
                {showActions ? (
                  <th scope="col" className={cn("px-4 py-2", STATES_ACTION_HEAD)} />
                ) : null}
              </tr>
            ) : null}
            <tr className={cn("text-muted-foreground type-label text-left font-semibold tracking-[0.12em] uppercase", STATES_HEAD_BG)}>
              <th scope="col" className={cn("px-4 py-3", STATES_COL_HEAD)}>
                <SortHeaderButton
                  label="Place"
                  active={sort?.key === "name"}
                  dir={sort?.key === "name" ? sort.dir : "asc"}
                  onClick={() => toggleSort("name")}
                />
              </th>
              {GENERAL_COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-3 py-3 text-center font-semibold">
                  <SortHeaderButton
                    label={c.label}
                    active={sort?.key === c.key}
                    dir={sort?.key === c.key ? sort.dir : "asc"}
                    onClick={() => toggleSort(c.key)}
                  />
                </th>
              ))}
              {showIntake
                ? INTAKE_COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className="px-3 py-3 text-center font-semibold">
                      {c.label}
                    </th>
                  ))
                : null}
              {showActions ? (
                <th scope="col" className={cn("px-4 py-3 text-right", STATES_ACTION_HEAD)}>
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {sortedPlaces.map((place) => (
              <PlaceStatesRow
                key={place.id}
                place={place}
                organizationId={organizationId}
                showActions={showActions}
                showIntake={showIntake}
                action={actionsByPlaceId?.[place.id]}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlaceStatesRow({
  place,
  organizationId,
  showActions,
  showIntake,
  action,
}: {
  place: ConsolePlace;
  organizationId: string;
  showActions: boolean;
  showIntake: boolean;
  action: React.ReactNode;
}) {
  const href = withOrg(placeHref(place.id), organizationId);
  const facts = factsFor(place);
  const intakeRows = showIntake
    ? intakeFunctionRows(
        place.enrichFunctions ?? null,
        typeof place.seeded === "boolean" ? place.seeded : "unknown",
      )
    : null;

  return (
    <tr className="[&>td]:border-border/60 hover:bg-muted/40 [&>td]:border-t">
      {/* IDENTITY — image and name, nothing else (Pato).
          The address and the org line that used to live here are gone. That
          costs something real on the pool, where two branches of one chain can
          truncate to the same ~22 characters next to a Claim button, so two
          things carry the weight instead without adding a third fact to the
          cell: the full name rides in `title`, and the name is a link, so a
          row you are unsure about is one click from being CHECKED rather than
          claimed. */}
      <td className={cn("max-w-[45vw] px-4 py-3 sm:max-w-[280px]", STATES_COL_CELL)}>
        <div className="flex min-w-0 items-center gap-3">
          <PlaceThumb place={place} />
          <Link
            href={href}
            title={place.name}
            className="min-h-[44px] min-w-0 truncate py-2 text-sm font-semibold hover:underline"
          >
            {place.name}
          </Link>
        </div>
      </td>

      {GENERAL_COLUMNS.map((c) => (
        <td key={c.key} className="px-3 py-3 text-center">
          {c.key === "requested" ? (
            <CountCell
              label={c.label}
              value={
                typeof place.requestCount === "number" ? place.requestCount : "unknown"
              }
            />
          ) : (
            <StateCell
              label={c.label}
              value={cellValue(place, facts, c.key)}
              falseTone={STATE_FACT_FALSE_TONE[c.key] ?? "pending"}
            />
          )}
        </td>
      ))}

      {intakeRows
        ? intakeRows.map((row) => (
            <td key={row.key} className="px-3 py-3 text-center">
              <StateCell
                label={row.label}
                value={row.on}
                note={row.failed ? "ran and failed" : undefined}
              />
            </td>
          ))
        : null}

      {showActions ? (
        <td className={cn("px-4 py-3 text-right whitespace-nowrap", STATES_ACTION_CELL)}>
          {action}
        </td>
      ) : null}
    </tr>
  );
}

/** One fact, from the shared reader where there is one and from the payload
 *  where the reader cannot know.
 *
 *  Owned and Enriched are read straight off the row on purpose. Owned is not
 *  in `generalHeaderFacts`' input at all. Enriched IS, but computed from the
 *  meter — and the EF answers with `isPlaceEnriched(enriched_at)`, which is
 *  what the Place screen this row links to will show. A list that contradicts
 *  its own destination is worse than one that contradicts another app. */
function cellValue(
  place: ConsolePlace,
  facts: ReturnType<typeof factsFor>,
  key: GeneralStateKey,
): boolean | "unknown" {
  if (key === "owned") {
    return typeof place.owned === "boolean" ? place.owned : "unknown";
  }
  if (key === "enriched") {
    return typeof place.enriched === "boolean" ? place.enriched : "unknown";
  }
  if (key === "partner") {
    return typeof place.partner === "boolean" ? place.partner : "unknown";
  }
  if (key === "verified") {
    return typeof place.verified === "boolean" ? place.verified : "unknown";
  }
  const fact = facts.get(key);
  return fact ? fact.on : "unknown";
}
