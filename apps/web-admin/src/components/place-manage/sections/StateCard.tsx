"use client";

// Profile States — the six facts of a place (Pato, 2026-10-13, MESITA-2176):
//
//   Created · Pulsing · Requested · Enriching · Enriched · Disabled
//
// The ladder is the next box, Enrichment Steps. It is not a state.
//
// Partnership States (Partnered · Rewards · Mesita Pay · Mesita Credits) went
// with the MVP First Stage cut (MESITA-2115): nothing commercial is live.
//
// This file renders Profile States. `StateRow` is the shared row shape.
//
// The state is Created; Seed is Crenup function 0. Wire key `seeded` /
// `isPlaceSeeded` stays.
//
//   Created    google_place_id present (identity spine)
//   Pulsing    Google pulse — Google OPERATIONAL (not Crenup 1. Pulse)
//   Disabled   places.state is not active — the operator's off switch
//   Requested  guest request count, 0…n — not a Yes/No
//   Enriching  Enricher pipeline mid-flight (live run). Independent of Enriched.
//   Enriched   an Enrich run completed — `enriched_at` set (MESITA-2154).
//              A yes/no, not the 0–8 high-water; a Created place is no.
//
// OPERATING is Google's, not ours (MESITA-1239). It answers "does this business
// still exist and trade", which is a different question from Disabled ("can a
// guest reach it on Mesita") — a place can be OPERATIONAL in Google and
// disabled here, or enabled here and long dead. It is a FLAG, never a gate:
// Google is wrong sometimes, and auto-disabling on a third-party signal would
// vanish a live place with no human in the loop (the Ojo posture).
//
// NAMING (Pato, 2026-08-22 · renamed 2026-09-05, MESITA-1541). This box is
// State, and CRENUP names something else entirely: the enrichment machinery.
// One word, one meaning.
//
// It used to be Status, which collided with the old `projects.status`
// (lead/active/paused/archived) — and the collision was handled by each row's
// detail line naming the column value rather than by renaming the box. That
// compromise is over: the house word is STATE, and `status` survives only
// inside a payload we did not author (HTTP, Stripe, Google). MESITA-1542
// renamed the columns too, so `place.state` / `content_state` /
// `business_state` below mirror the schema exactly — one word, one meaning.

import { useEffect, useState } from "react";
import { CircleCheck, Loader2 } from "lucide-react";
import {
  getPlaceEnrichment,
  setPlaceActive,
  setPlaceListed,
  type AdminPlace,
  type PlaceEnrichmentState,
} from "../actions";
import { isEnriching, listedFromState } from "../place-header-state";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { ConfirmDialog, SectionCard } from "@/components/admin-ui/manage";
import { usePlaceContext } from "../PlaceContext";
import { ErrorNote } from "@/components/ErrorNote";
import {
  requestCountChip,
  requestCountFromRow,
  stateBoolChip,
} from "@/lib/state-vocabulary";
import { crenupMeterLine } from "./state-enrichment";

// States box (Pato, 2026-08-25): bools. Crenup is the next box — not chips
// under Enriched, and not a Create / Enrich split. Chips never repeat the row
// name.
//
//   Created    a google_place_id exists. Nothing enriches without it.
//   Disabled   a guest cannot reach the place AT ALL. places.state = active
//              is what the consumer RLS policy places_select_public_visible
//              gates on — its content_state leg allows every label, so state
//              alone decides. Disabled is not a RUNG — nothing progresses
//              through it — but it is not a constant either: Disable writes
//              `paused` and every guest surface stops resolving it. Read it
//              from `state`, never from a merged overview `listed` flag that
//              can go stale after that write.
//
// Created arrives computed on the super-admin overview payload
// (admin-web-get-overview → _shared/place-state.ts), the same helper the
// Single Place table uses, so the box and the table can never disagree.

export function StateCard({ place }: { place: AdminPlace }) {
  // The pipeline facts ride on the super-admin overview payload. An
  // absent key means an older payload, not a "no": misreporting a real
  // place is worse than admitting the read failed.
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const listedFromRow = listedFromState(place.state);
  const listed: boolean | "unknown" =
    listedFromRow !== "unknown"
      ? listedFromRow
      : typeof place.listed === "boolean"
        ? place.listed
        : "unknown";
  const placeState = typeof place.state === "string" ? place.state : null;

  const seededDetail =
    seeded === "unknown"
      ? "Couldn't read the identity spine."
      : seeded
        ? "Google's place id is on the row — the pipeline has something to start from."
        : "No google_place_id. Nothing can enrich this place until one lands.";

  // Disabled is Listed turned over: true when the place is switched off.
  const disabled: boolean | "unknown" = listed === "unknown" ? "unknown" : !listed;

  const disabledDetail =
    disabled === "unknown"
      ? "Couldn't read the place's state."
      : placeState === "active"
        ? "Enabled — on every consumer surface, and in the discovery pool."
        : placeState
          ? `${placeState} — no guest surface resolves this place; the RLS policy stops the read.`
          : "No state on the row.";

  // ── Operating (MESITA-1239) — Google's word on the business itself.
  //
  // Three Google values plus silence, collapsed onto the row's tri-state:
  // OPERATIONAL is a yes, either CLOSED_* is a no, and an absent value is
  // "unknown" rather than a false no — the same rule Created and Disabled follow.
  // The chip is the bool; CLOSED_* wording stays in the detail line.
  const bizStatus = typeof place.business_state === "string"
    ? place.business_state
    : null;
  const operating: boolean | "unknown" = bizStatus === null
    ? "unknown"
    : bizStatus === "OPERATIONAL";
  // A liveness claim with no date reads as current however old it is, so the
  // row says when Google last told us.
  const operatingSeen = typeof place.business_state_at === "string"
    ? new Date(place.business_state_at).toLocaleDateString()
    : null;
  const operatingDetail = bizStatus === null
    ? "Google has not reported a business status for this listing yet."
    : bizStatus === "OPERATIONAL"
      ? `Open and trading${operatingSeen ? ` (seen ${operatingSeen})` : ""}. Pulse can refresh this from Google. Off also disables.`
      : bizStatus === "CLOSED_TEMPORARILY"
        ? `Temporary close${operatingSeen ? ` (seen ${operatingSeen})` : ""} — a refurb or a seasonal break. Marking inactive also disables.`
        : `Permanently closed${operatingSeen ? ` (seen ${operatingSeen})` : ""}. Inactive. Enabling it again is a separate write.`;

  const [enrichState, setEnrichState] = useState<PlaceEnrichmentState | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      if (r.ok) setEnrichState(r.data.state);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);

  const contentState =
    typeof place.content_state === "string" ? place.content_state : null;
  const enriching = isEnriching(
    enrichState ?? {
      content_state: contentState,
      stage: null,
      stage_state: null,
      error: null,
      last_enriched_at: null,
      updated_at: null,
      serp_summary: null,
    },
  );
  const enriched = isEnrichedPlace(place);
  const meter = crenupMeterLine(place);
  const enrichedAt =
    typeof place.enriched_at === "string" && place.enriched_at.trim() !== ""
      ? place.enriched_at.slice(0, 10)
      : null;
  const enrichedDetail =
    (enriched
      ? "An Enrich run completed" + (enrichedAt ? ` ${enrichedAt}.` : ".")
      : "No Enrich run has completed — a Created profile is not enriched.") +
    (meter ? ` ${meter}` : "");
  const requestCount = requestCountFromRow(place.request_count);
  const requestedDetail =
    requestCount === "unknown"
      ? "Couldn't read the request count."
      : requestCount === 0
        ? "No guest has requested this profile."
        : `${requestCount} guest request${requestCount === 1 ? "" : "s"}.`;
  const enrichingDetail = enriching
    ? "The Enricher pipeline is mid-flight — first, second, or third is running."
    : "No Enricher run is in flight.";

  return (
    <SectionCard
      icon={<CircleCheck className="h-4 w-4" />}
      tint="emerald"
      title="Profile States"
    >
      <div className="mt-5 flex flex-col">
        <StateRow
          name="Created"
          on={seeded === true}
          chip={stateBoolChip(seeded)}
          detail={seededDetail}
        />
        <StateRow
          name="Pulsing"
          on={operating === true}
          chip={stateBoolChip(operating)}
          detail={operatingDetail}
          action={<ActiveToggle place={place} operating={operating} />}
        />
        <StateRow
          name="Requested"
          on={requestCount !== "unknown" && requestCount > 0}
          chip={requestCountChip(place.request_count)}
          detail={requestedDetail}
        />
        <StateRow
          name="Enriching"
          on={enriching}
          chip={stateBoolChip(enriching)}
          detail={enrichingDetail}
        />
        <StateRow
          name="Enriched"
          on={enriched === true}
          chip={stateBoolChip(enriched)}
          detail={enrichedDetail}
        />
        <StateRow
          name="Disabled"
          on={disabled === true}
          chip={stateBoolChip(disabled)}
          detail={disabledDetail}
          action={<ListedToggle place={place} listed={listed} />}
        />
      </div>
    </SectionCard>
  );
}


export function StateRow({
  name,
  on,
  chip,
  detail,
  action,
}: {
  name: string;
  on: boolean;
  /** `true`/`false`/`?`/`…` for bools, `0…n` for Requested, `0`/`1`/`2` for Promoted. */
  chip: string;
  detail: string;
  /** Control under the detail. Pulsing and Disabled are the two operator writes. */
  action?: React.ReactNode;
}) {
  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <span className="text-foreground/90 type-body font-medium">{name}</span>
        <p className="text-foreground/70 mt-1 type-label font-medium">{detail}</p>
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
      <span
        className={
          "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 type-label font-semibold tabular-nums " +
          (on ? "bg-muted text-foreground" : "bg-muted text-muted-foreground")
        }
        aria-label={`${name}: ${chip}`}
      >
        {chip}
      </span>
    </div>
  );
}


/**
 * Pulsing is the operator override of business_state. Off also disables
 * (admin-web-set-place-active). On writes OPERATIONAL and does not list.
 * Confirm the off direction — guests disappear with the disable.
 */
function ActiveToggle({
  place,
  operating,
}: {
  place: AdminPlace;
  operating: boolean | "unknown";
}) {
  const { setPlace } = usePlaceContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const apply = (next: boolean) => {
    setError(null);
    setPending(true);
    void setPlaceActive(place.id, next).then((r) => {
      setPending(false);
      setConfirming(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPlace(r.data);
    });
  };

  const active = operating === true;

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (active ? setConfirming(true) : apply(true))}
        className={
          "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50 " +
          (active
            ? "border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground"
            : "border-transparent bg-pink-gradient text-white shadow-save hover:brightness-105")
        }
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {active ? "Mark inactive" : "Mark active"}
      </button>
      {error ? <ErrorNote message={error} /> : null}

      <ConfirmDialog
        open={confirming}
        title="Mark inactive and disable?"
        danger
        busy={pending}
        confirmLabel="Mark inactive"
        body={
          <p>
            {place.name} is marked closed, and guests stop finding it
            everywhere at once — browse, search, the swipe deck, and any
            link already shared. Enabling it again is a separate write.
          </p>
        }
        onCancel={() => setConfirming(false)}
        onConfirm={() => apply(false)}
      />
    </>
  );
}

/**
 * Disabled writes places.state through admin-web-set-place-listed.
 * Disabling is confirmed rather than immediate: the consumer RLS policy
 * gates every guest read on this one value.
 */
function ListedToggle({
  place,
  listed,
}: {
  place: AdminPlace;
  listed: boolean | "unknown";
}) {
  const { setPlace } = usePlaceContext();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // An unknown Listed value means an older overview payload, not a "no".
  // Offering a toggle there would let one click write a state derived from a
  // fact we admit we could not read.
  if (listed === "unknown") return null;

  const apply = (next: boolean) => {
    setError(null);
    setPending(true);
    void setPlaceListed(place.id, next).then((r) => {
      setPending(false);
      setConfirming(false);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPlace(r.data);
    });
  };

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (listed ? setConfirming(true) : apply(true))}
        className={
          "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition active:scale-[0.98] disabled:opacity-50 " +
          (listed
            ? "border-border/70 text-foreground/70 hover:bg-muted hover:text-foreground"
            : "border-transparent bg-pink-gradient text-white shadow-save hover:brightness-105")
        }
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {listed ? "Disable" : "Enable"}
      </button>
      {error ? <ErrorNote message={error} /> : null}

      <ConfirmDialog
        open={confirming}
        title="Disable this place?"
        danger
        busy={pending}
        confirmLabel="Disable"
        body={
          <p>
            Guests stop finding {place.name} everywhere at once — browse,
            search, the swipe deck, and any link already shared. Tickets and
            history are untouched, and you can enable it again whenever you want.
          </p>
        }
        onConfirm={() => apply(false)}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
