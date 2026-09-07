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
// INTAKE IS NOT ON THIS TABLE (Pato, 2026-09-07: "the intake states are
// internal"). MESITA-1608 put the eleven Intake function columns here beside
// the general ones; this reverses that half of it. How far our pipeline got on
// a place is operator knowledge — it answers a question the business never
// asked and cannot act on, and it already has a home on the super-admin-only
// Admin tab of the Place screen. The EF stopped shipping `enrich_functions`
// with it, because "internal" is a reason not to put the map in a business
// browser at all, not merely a reason to hide it.
//
// What SURVIVES from intake is the general pair, Enriching and Enriched, and
// they stay: those are facts about the PLACE, not about our machinery. Neither
// needs the meter — Enriching is its own boolean and Enriched is the EF's
// `isPlaceEnriched(enriched_at)` answer, read straight off the row below. The
// meter used to be fed to `generalHeaderFacts` here and then thrown away by
// `cellValue`; it left the payload with the map.
//
// ONE COLUMN SET NOW. Partner and Verified still read "?" on a pool row —
// `getAuthedUser` accepts ANY bearer token and the backend is a singleton, so
// every consumer account can read that scope and the EF withholds those facts.
// This component just renders what it is given.
import Link from "next/link";

import { CountCell, StateCell } from "@/components/console/StateCell";
import { placeHref, withOrg } from "@/lib/console-routes";
import { placeThumbUrl } from "@/lib/place-thumb";
import { generalHeaderFacts } from "@/components/place-manage/place-header-state";
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
  renderAction,
}: {
  places: ConsolePlace[];
  organizationId: string;
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
        {/* 1180px carries identity + nine state columns + the action cell. The
              lg:min-w-[1560px] that used to sit here was sized for TWENTY
              columns — nine general plus eleven Intake functions — and after
              MESITA-1637 it spent 380px spreading nine yes/no cells apart,
              which is most of why the header read as adrift (MESITA-1651). */}
          <table className="w-full min-w-[1180px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">
            One row per place. The left column is the place; every other column
            is a state, reading yes, no, or ? when the fact was not available.
          </caption>
          <thead className={STATES_HEAD_STICKY}>
            {/* ONE TIER (MESITA-1651). There were two, and the second one's
                comment gave its own reason away: "the vocabulary is TWO BOXES
                by decision" — General States and Intake States. MESITA-1637
                took Intake off this table and the group row outlived its
                reason, leaving a label that spanned every column and named
                nothing the column heads do not already say. A heading that
                labels everything labels nothing, and on a wide screen it read
                as a stray word floating over empty space.

                If a second group ever returns, the group row returns with it —
                as a row that appears BECAUSE there are two groups, not as
                permanent chrome. */}
            <tr className={cn("text-muted-foreground type-label text-left font-semibold tracking-[0.12em] uppercase", STATES_HEAD_BG)}>
              <th scope="col" className={cn("px-4 py-3", STATES_COL_HEAD)}>
                Place
              </th>
              {GENERAL_COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="px-3 py-3 text-center font-semibold">
                  {c.label}
                </th>
              ))}
              {showActions ? (
                <th scope="col" className={cn("px-4 py-3 text-right", STATES_ACTION_HEAD)}>
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
  showActions,
  action,
}: {
  place: ConsolePlace;
  organizationId: string;
  showActions: boolean;
  action: React.ReactNode;
}) {
  const href = withOrg(placeHref(place.id), organizationId);
  const facts = factsFor(place);

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
