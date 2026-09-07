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
// TWO SCREENS, TWO COLUMN SETS. Org Places shows everything: you hold those
// addresses. Public Places drops the intake block and reads "?" for Partner
// and Verified, because `getAuthedUser` accepts ANY bearer token and the
// backend is a singleton — every consumer account can read that scope. The
// EF withholds those facts; this component just renders what it is given.
import Link from "next/link";

import { CountCell, StateCell } from "@/components/console/StateCell";
import { placeHref, withOrg } from "@/lib/console-routes";
import { placeThumbUrl } from "@/lib/place-thumb";
import { generalHeaderFacts } from "@/components/place-manage/place-header-state";
import { intakeFunctionRows } from "@/components/place-manage/sections/state-enrichment";
import {
  GENERAL_STATE_FACTS,
  STATE_FACT_FALSE_TONE,
  type GeneralStateKey,
} from "@/lib/state-vocabulary";
import {
  SHELL_BLEED,
  STATES_ACTION_CELL,
  STATES_ACTION_HEAD,
  STATES_COL_CELL,
  STATES_COL_HEAD,
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
 * That is NOT `GENERAL_STATE_FACTS`' order, which puts Enriched before
 * Enriching and predates Owned. The labels still come from the constant so
 * the two apps cannot drift on wording; only the sequence is local, and it is
 * named here rather than inlined so a test can see it is a decision.
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
      // generalHeaderFacts computes Enriched from the meter. The list ships
      // the EF's own `isPlaceEnriched(enriched_at)` answer, and the row links
      // to the Place screen — so the list must agree with its DESTINATION,
      // not with a third definition. Feed the meter so the shape matches,
      // then override below.
      enrich_pulse: place.intakePulse,
      enrich_pulse_total: place.intakeTotal,
      partner: place.partner ?? false,
      verified: place.verified ?? "unknown",
    }).map((f) => [f.key, f]),
  );
  return general;
}

export function PlaceStatesTable({
  places,
  organizationId,
  showIntake,
  renderAction,
}: {
  places: ConsolePlace[];
  organizationId: string;
  /** Org Places only. The pool's payload carries no intake map, and rendering
   *  eleven "?" columns there would spend ~450px saying nothing. */
  showIntake: boolean;
  /** The action cell, INJECTED rather than imported.
   *
   *  PlaceHoldButton is a client component that imports a "use server" module,
   *  so importing it here would drag next/headers into any node test that
   *  renders this table — and renderToStaticMarkup against fixtures is the
   *  only proof this screen can ever have (it is OTP-gated and the catalog is
   *  empty). Returning null collapses the column, which is also how a viewer
   *  with no claim/release rights renders. */
  renderAction?: (place: ConsolePlace) => React.ReactNode;
}) {
  const intakeColumns = showIntake
    ? intakeFunctionRows(null, "unknown").map((r) => ({ n: r.n, label: r.label, key: r.key }))
    : [];
  const showActions = Boolean(renderAction);

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
        <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm lg:min-w-[1560px]">
          <caption className="sr-only">
            One row per place. The left column is the place; every other column
            is a state, reading yes, no, or ? when the fact was not available.
          </caption>
          <thead className={STATES_HEAD_STICKY}>
            {/* Two tiers. The vocabulary is TWO BOXES by decision (Pato,
                2026-08-25) and the single-place State box already splits the
                same way; without the group row twenty pills read as one
                undifferentiated smear. */}
            <tr className="text-muted-foreground bg-muted/30 type-label text-left font-semibold tracking-[0.12em] uppercase">
              <th scope="col" className={cn("px-4 py-2", STATES_COL_HEAD)}>
                Place
              </th>
              <th scope="colgroup" colSpan={GENERAL_COLUMNS.length} className="px-3 py-2 text-center">
                General States
              </th>
              {showIntake ? (
                <th
                  scope="colgroup"
                  colSpan={intakeColumns.length}
                  className="border-border border-l-2 px-3 py-2 text-center"
                >
                  Intake States
                </th>
              ) : null}
              {showActions ? (
                <th scope="col" className={cn("px-4 py-2 text-right", STATES_ACTION_HEAD)}>
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
            <tr className="text-muted-foreground bg-muted/30 type-label text-left font-semibold tracking-[0.12em] uppercase">
              <th scope="col" className={cn("px-4 pb-3", STATES_COL_HEAD)}>
                <span className="sr-only">Place</span>
              </th>
              {GENERAL_COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-3 pb-3 text-center font-semibold">
                  {c.label}
                </th>
              ))}
              {intakeColumns.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.label}
                  aria-label={c.label}
                  className={cn(
                    "px-3 pb-3 text-center font-semibold",
                    i === 0 && "border-border border-l-2",
                  )}
                >
                  <span className="lg:hidden">{c.n}</span>
                  <span className="hidden lg:inline">{c.label}</span>
                </th>
              ))}
              {showActions ? (
                <th scope="col" className={cn("px-4 pb-3", STATES_ACTION_HEAD)}>
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {places.map((place) => (
              <PlaceStatesRow
                key={place.id}
                place={place}
                organizationId={organizationId}
                showIntake={showIntake}
                showActions={showActions}
                action={renderAction?.(place)}
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
  showIntake,
  showActions,
  action,
}: {
  place: ConsolePlace;
  organizationId: string;
  showIntake: boolean;
  showActions: boolean;
  action: React.ReactNode;
}) {
  const href = withOrg(placeHref(place.id), organizationId);
  const facts = factsFor(place);
  const intake = showIntake
    ? intakeFunctionRows(place.enrich_functions ?? null, place.seeded ?? "unknown")
    : [];

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

      {intake.map((row, i) => (
        <td
          key={row.key}
          className={cn("px-3 py-3 text-center", i === 0 && "border-border border-l-2")}
        >
          <StateCell
            label={row.label}
            value={row.on}
            // A function that has not run yet is not a debt the operator owes.
            // Rose across eleven columns on every fresh place is the exact
            // "wall of red" a matrix invites, and this is where it is refused.
            falseTone="neutral"
            note={row.failed ? "it ran and could not finish" : undefined}
          />
        </td>
      ))}

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
