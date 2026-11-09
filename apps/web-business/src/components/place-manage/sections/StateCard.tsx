"use client";

// Profile States — what comes from Google or Mesita (Pato, 2026-10-13,
// MESITA-2176; Selected died and Boost became Premier in MESITA-2925; Owned
// moved to Place States, MESITA-3588, Main §10):
//
//   Created · Pulsing · Enriching · Enriched · Premier · Disabled
//
// Enriching and Enriched are the only enrichment states. A live run is
// enriching; the one finished write is enriched. Premier is the paid tier
// (`places.boost_tier`), read-only here. Disabled is read-only too: Enable
// and Disable are buttons in Special actions (MESITA-3159).
//
// What the business decides (Owned, Plan, Billing, Stripe, Reservations and
// the payment states) is Place States, PlaceStatesCard.tsx (MESITA-3588).
//
// This file renders Profile States. `StateRow` is the shared row shape.
//
// The state is Created; Seed is Crenup function 0. Wire key `seeded` /
// `isPlaceSeeded` stays.
//
//   Created    google_place_id present (identity spine)
//   Pulsing    Google pulse — Google OPERATIONAL (not Crenup 1. Pulse)
//   Disabled   places.state is not active — the operator's off switch
//   Enriching  a run is in flight (`content_state = generating`).
//   Enriched   the one write landed — `enriched_at` set (MESITA-2154).
//              A live run shows enriching, not enriched.
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
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import {
  getPlaceEnrichment,
  type AdminPlace,
  type PlaceEnrichmentState,
} from "../actions";
import { isEnriching, listedFromState } from "../place-header-state";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { SectionCard } from "@/components/ui/manage";
import { premierTierChip, stateBoolChip } from "@/lib/state-vocabulary";
// States box (Pato, 2026-08-25): bools. Enriching and Enriched are the two
// enrichment states. Chips never repeat the row name.
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
      ? `Open and trading${operatingSeen ? ` (seen ${operatingSeen})` : ""}. Pulse can refresh this from Google.`
      : bizStatus === "CLOSED_TEMPORARILY"
        ? `Temporary close${operatingSeen ? ` (seen ${operatingSeen})` : ""} — a refurb or a seasonal break.`
        : `Permanently closed${operatingSeen ? ` (seen ${operatingSeen})` : ""}. Inactive.`;

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
      last_enriched_at: null,
    },
  );
  const enriched = enriching ? false : isEnrichedPlace(place);
  const enrichedAt =
    typeof place.enriched_at === "string" && place.enriched_at.trim() !== ""
      ? place.enriched_at.slice(0, 10)
      : null;
  const enrichedDetail = enriched
    ? "An Enrich run completed" + (enrichedAt ? ` ${enrichedAt}.` : ".")
    : enriching
      ? "A run is in progress. The profile is written once, when it finishes."
      : "No Enrich run has completed — a Created profile is not enriched.";
  // Premier (MESITA-2925, was Boost — MESITA-2789, shown here since
  // MESITA-2795): paid visibility guests bought, read off `places.boost_tier`
  // (1 · 2 = 2X · 5X). Read-only: payers manage it in the consumer
  // app; the Premier view lists them.
  const premierTier =
    typeof place.boost_tier === "number" ? place.boost_tier : null;
  const premier: boolean | "unknown" =
    premierTier == null ? "unknown" : premierTier > 0;
  const premierDetail =
    premier === "unknown"
      ? "Couldn't read the Premier tier."
      : premier
        ? `Premier ${premierTierChip(premierTier)}: guests pay for its visibility and see it marked Premier. Payers are on the Premier view.`
        : "Not Premier. Guests make a place Premier from its ⋯ menu.";
  const enrichingDetail = enriching
    ? "A run is in progress. Nothing is saved until the profile is finished."
    : "No run is in progress.";

  return (
    <SectionCard
      icon={<CheckCircleIcon size={20} />}
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
          name="Premier"
          on={premier === true}
          chip={premierTierChip(premierTier)}
          detail={premierDetail}
        />
        <StateRow
          name="Disabled"
          on={disabled === true}
          chip={stateBoolChip(disabled)}
          detail={disabledDetail}
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
  /** Control under the detail. Disabled is the operator write. */
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
