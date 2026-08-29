"use client";

// Status — the Statuses box: nine bools (`true`/`false`) plus Requested
// `0…n` and Promoted `0|1|2`, each from its own source. Intake
// (0. Seed … 10. Embedding) lives in IntakeStatusCard.
//
// The state is Created; Seed is Intake function 0. Wire key `seeded` /
// `isPlaceSeeded` stays.
//
//   Created    google_place_id present (identity spine)
//   Active     Google pulse — Google OPERATIONAL (not Intake 1. Pulse)
//   Listed     projects.status ∈ (active, lead)
//   Requested  guest request count, 0…n — not a Yes/No
//   Enriched   PULSE complete — a yes, not a 0–10 high-water.
//   Enriching  Intaker pipeline mid-flight (live run). Independent of Enriched.
//   Verified   approved project_verifications
//   Partnered  plan ≠ free
//   Promoted   0 Zero · 1 Conservative · 2 Aggressive (not a bool)
//   Mesita Pay places.mesita_pay_enabled — cleared to accept the in-Mesita
//              card rail when it goes live (intent bit; write-door rejected)
//   Accepts Yums places.yums_enabled — cleared to accept Yums (Credits)
//              when they land (same contract)
//
// OPERATING is Google's, not ours (MESITA-1239). It answers "does this business
// still exist and trade", which is a different question from Listed ("can a
// guest reach it on Mesita") — a place can be OPERATIONAL in Google and
// unlisted here, or listed here and long dead. It is a FLAG, never a gate:
// Google is wrong sometimes, and auto-unlisting on a third-party signal would
// vanish a live place with no human in the loop (the Ojo posture).
//
// NAMING (Pato, 2026-08-22). This box is Status, and PULSE names something
// else entirely: the enrichment machinery. One word, one meaning.
//
// The word collides with `projects.status` (lead/active/paused/archived) —
// NOT `places.status`, which does not exist: the column moved to `projects`
// when the entity was split, and never came back. The collision is handled by
// each row's own detail line naming the column value, not by renaming the box.

import { useEffect, useState } from "react";
import { AlertTriangle, CircleCheck, Loader2 } from "lucide-react";
import {
  getPlaceEnrichment,
  setPlaceActive,
  setPlaceListed,
  type AdminPlace,
  type PlaceEnrichmentStatus,
} from "../actions";
import { isEnriching, listedFromStatus } from "../place-header-status";
import { ConfirmDialog, SectionCard } from "@/components/admin-ui/manage";
import { usePlaceContext } from "../PlaceContext";
import { ErrorNote } from "@/components/ErrorNote";
import {
  effectiveStrikeCount,
  isMemberPlan,
  membershipPillState,
} from "./promo-state";
import { strategyForPlace } from "@/lib/business/strategies";
import {
  OPERATOR_PROMOTING_LABEL,
  promotingLevelChip,
  promotingLevelFromStrategy,
  requestCountChip,
  requestCountFromRow,
  statusBoolChip,
} from "@/lib/status-vocabulary";

// Statuses box (Pato, 2026-08-25 · acceptance bits 2026-08-29): nine bools +
// Requested 0…n + Promoted 0|1|2. Intake is the next box — not chips under
// Enriched, and not a Create 1–5 / Enrich 1–10 split. Chips never repeat the
// row name.
//
//   Created    a google_place_id exists. Nothing enriches without it.
//   Listed     a guest can reach the place AT ALL. projects.status ∈
//              (active, lead) is what the consumer RLS policy
//              projects_select_public_visible gates on — its content_status
//              leg is a tautology (all four labels of the enum are allowed),
//              so status alone decides. Product Rules §B is right that Listed
//              is not a RUNG — nothing progresses through it — but it is not a
//              constant either: Unlist writes `paused` and every guest surface
//              stops resolving it. Read it from `status`, never from a merged
//              overview `listed` flag that can go stale after that write.
//   Requested  guest request count (0…n). Independent of Listed / Enriched.
//   Enriched   the PULSE queue finished. A yes, not a high-water.
//   Enriching  the Intaker pipeline is mid-flight. Live-run, not last-completed.
//   Verified   somebody proved they own it. One-time, never lapses.
//   Partnered  the place pays Mesita. A deal: stable, internal. Wire key `partner`.
//   Promoted   0 Zero · 1 Conservative · 2 Aggressive. Volatile, and the
//              only one of the eleven a guest is ever shown. Engine Dominant
//              (3) displays as 2.
//
// Created, Listed and Enriched arrive computed on the super-admin overview
// payload (business-web-get-overview → _shared/place-status.ts and
// _shared/pulse-pieces.ts), the same helpers the Single Place table uses, so
// the box and the table can never disagree. That guarantee was only half true
// until MESITA-1218: the chip read the 0-10 high-water while this box's prose
// read a rival 0-3 stage level, and on every row they disagreed. Partner and
// Promoted are derived here from columns on the row; Verified is a separate
// admin read hoisted into AdminSection.
//
// `listing_type` backs NONE of them, deliberately: it stores
// (pays ∧ strategy ≠ zero) collapsed into one enum and is re-derived only when
// something writes the place, so it can answer neither question separately and
// goes stale over a paused lane. Each row reads its own source instead, and the
// box says so out loud when the stored enum disagrees.

type Verification = {
  verifiedByEmail: string | null;
  decidedAt: string | null;
  method: string | null;
} | null;


/** Does a guest get a discount here RIGHT NOW? The live read, not the badge. */
export function isPromotingNow(place: AdminPlace): boolean {
  if (!isMemberPlan(place.plan)) return false;
  const strategy = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  if (strategy === null || strategy === "zero") return false;
  const state = membershipPillState(place);
  // Paused (strike 2) and forfeited (strike 3) both close the promo lane.
  // `pending` still promotes — the place has promised a discount, it just
  // hasn't honored its first check yet.
  return state !== "paused" && state !== "forfeited";
}

/** Operator Promoted chip: 0 | 1 | 2 from the live lane + strategy. */
export function placeOperatorPromotingLevel(place: AdminPlace): 0 | 1 | 2 {
  const strategy = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  return promotingLevelFromStrategy(isPromotingNow(place), strategy);
}

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
};

export function StatusCard({
  place,
  verification,
  verificationError,
}: {
  place: AdminPlace;
  /** undefined while the read is in flight. */
  verification: Verification | undefined;
  verificationError: string | null;
}) {
  const plan = typeof place.plan === "string" ? place.plan : "free";
  const partner = isMemberPlan(plan);
  const promoting = isPromotingNow(place);
  const promotingLevel = placeOperatorPromotingLevel(place);
  const state = membershipPillState(place);
  const strikes = effectiveStrikeCount(place);
  const strategy = strategyForPlace({
    welcome_free_rate: place.welcome_free_rate,
    welcome_premium_rate: place.welcome_premium_rate,
    free_rate: place.free_rate,
    premium_rate: place.premium_rate,
  });
  const badged = place.listing_type === "partner";

  // The three pipeline facts ride on the super-admin overview payload. An
  // absent key means an older payload, not a "no" — same rule Verified
  // follows: misreporting a real place is worse than admitting the read
  // failed.
  const seeded: boolean | "unknown" =
    typeof place.seeded === "boolean" ? place.seeded : "unknown";
  const listedFromRow = listedFromStatus(place.status);
  const listed: boolean | "unknown" =
    listedFromRow !== "unknown"
      ? listedFromRow
      : typeof place.listed === "boolean"
        ? place.listed
        : "unknown";
  const requestCount = requestCountFromRow(place.request_count);
  // Enriched is complete-or-not, from the same high-water the catalog uses.
  // A missing number is unknown, not a no.
  const [enrichStatus, setEnrichStatus] = useState<PlaceEnrichmentStatus | null>(
    null,
  );
  useEffect(() => {
    let alive = true;
    getPlaceEnrichment(place.id).then((r) => {
      if (!alive) return;
      if (r.ok) setEnrichStatus(r.data.status);
    });
    return () => {
      alive = false;
    };
  }, [place.id]);
  const contentStatus =
    typeof place.content_status === "string" ? place.content_status : null;
  const enriching = isEnriching(
    enrichStatus ?? {
      content_status: contentStatus,
      stage: null,
      stage_status: null,
      error: null,
      last_enriched_at: null,
      updated_at: null,
      serp_summary: null,
    },
  );

  const pulse = typeof place.enrich_pulse === "number" ? place.enrich_pulse : null;
  const pulseTotal = typeof place.enrich_pulse_total === "number"
    ? place.enrich_pulse_total
    : null;
  const enriched: boolean | "unknown" =
    pulse === null || pulseTotal === null || pulseTotal === 0
      ? "unknown"
      : pulse >= pulseTotal;
  const placeStatus = typeof place.status === "string" ? place.status : null;

  const seededDetail =
    seeded === "unknown"
      ? "Couldn't read the identity spine."
      : seeded
        ? "Google's place id is on the row — the pipeline has something to start from."
        : "No google_place_id. Nothing can enrich this place until one lands.";

  const listedDetailBase =
    listed === "unknown"
      ? "Couldn't read the place's status."
      : placeStatus === "active"
        ? "active — on every consumer surface, and in the discovery pool."
        : placeStatus === "lead"
          ? "lead — reachable by link and by search, but discovery pools active places only."
          : placeStatus
            ? `${placeStatus} — no guest surface resolves this place; the RLS policy stops the read.`
            : "No status on the row.";
  const listedDetail = listedDetailBase;

  const requestedDetail =
    requestCount === "unknown"
      ? "Couldn't read the request count."
      : requestCount === 0
        ? "No guest has requested this profile."
        : `${requestCount} guest request${requestCount === 1 ? "" : "s"}.`;

  // ── Operating (MESITA-1239) — Google's word on the business itself.
  //
  // Three Google values plus silence, collapsed onto the row's tri-state:
  // OPERATIONAL is a yes, either CLOSED_* is a no, and an absent value is
  // "unknown" rather than a false no — the same rule Created and Listed follow.
  // The chip is the bool; CLOSED_* wording stays in the detail line.
  const bizStatus = typeof place.business_status === "string"
    ? place.business_status
    : null;
  const operating: boolean | "unknown" = bizStatus === null
    ? "unknown"
    : bizStatus === "OPERATIONAL";
  // A liveness claim with no date reads as current however old it is, so the
  // row says when Google last told us.
  const operatingSeen = typeof place.business_status_at === "string"
    ? new Date(place.business_status_at).toLocaleDateString()
    : null;
  const operatingDetail = bizStatus === null
    ? "Google has not reported a business status for this listing yet."
    : bizStatus === "OPERATIONAL"
      ? `Open and trading${operatingSeen ? ` (seen ${operatingSeen})` : ""}. Pulse can refresh this from Google. Off also unlists.`
      : bizStatus === "CLOSED_TEMPORARILY"
        ? `Temporary close${operatingSeen ? ` (seen ${operatingSeen})` : ""} — a refurb or a seasonal break. Marking inactive also unlists.`
        : `Permanently closed${operatingSeen ? ` (seen ${operatingSeen})` : ""}. Inactive. Re-list is a separate write.`;

  const enrichingDetail = enriching
    ? "The Intaker pipeline is mid-flight — research, analysis, or contents is running."
    : "No Intaker run is in flight.";

  const enrichedDetail =
    enriched === "unknown"
      ? "Couldn't read the pipeline events."
      : enriched
        ? "The Intake queue finished." +
          (place.enriched_at
            ? ` Last run ${String(place.enriched_at).slice(0, 10)}.`
            : "")
        : "The Intake queue has not finished.";

  // An unknown must never render as a false negative: misreporting a real
  // place's standing is worse than admitting the lookup failed.
  const verified: boolean | "unknown" | "loading" = verificationError
    ? "unknown"
    : verification === undefined
      ? "loading"
      : Boolean(verification?.verifiedByEmail);

  const verifiedDetail = verificationError
    ? "Couldn't read the verification record."
    : verification === undefined
      ? "Checking…"
      : verification?.verifiedByEmail
        ? [
            verification.method ? methodLabel(verification.method) : null,
            verification.decidedAt ? verification.decidedAt.slice(0, 10) : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Ownership proven."
        : "Nobody has proven ownership yet.";

  const partnerDetail =
    (PLAN_LABEL[plan] ?? plan) +
    (state === "pending"
      ? " · not live until the first honored check"
      : state === "paused"
        ? " · promo lane paused (strike 2)"
        : state === "forfeited"
          ? " · forfeited after 3 strikes"
          : strikes > 0
            ? ` · ${strikes} active strike${strikes === 1 ? "" : "s"}`
            : partner
              ? " · live"
              : " · costs them nothing");

  // Acceptance intent bits ride the same super-admin overview payload, read
  // off `places` by the side-read (never through profiles). Absent means an
  // older payload — "?" rather than a false "no", the Verified rule.
  const mesitaPay: boolean | "unknown" =
    typeof place.mesita_pay_enabled === "boolean" ? place.mesita_pay_enabled : "unknown";
  const yums: boolean | "unknown" =
    typeof place.yums_enabled === "boolean" ? place.yums_enabled : "unknown";
  const mesitaPayDetail =
    mesitaPay === true
      ? "Cleared to accept Mesita Pay when the rail goes live."
      : "Not accepting Mesita Pay yet — structure only; the Stripe gateway comes later.";
  const yumsDetail =
    yums === true
      ? "Cleared to accept Yums when Credits go live."
      : "Not accepting Yums yet — structure only; the Credits engine comes later.";

  const promotingName = OPERATOR_PROMOTING_LABEL[promotingLevel];
  const promotingDetail =
    strategy === null
      ? `Custom rates (${promotingLevel}) — no preset strategy.`
      : strategy === "zero" || promotingLevel === 0
        ? state === "paused"
          ? "Lane paused — the strategy is set but nothing is claimable (0)."
          : state === "forfeited"
            ? "Lane closed after three strikes (0)."
            : !partner
              ? "No paid plan, so no discount resolves (0)."
              : "Zero (0) — no discount offered."
        : `${promotingName} (${promotingLevel}) strategy, lane open.`;

  return (
    <SectionCard
      icon={<CircleCheck className="h-4 w-4" />}
      tint="emerald"
      title="Status"
    >
      <div className="mt-5 flex flex-col">
        <StatusRow
          name="Created"
          on={seeded === true}
          chip={statusBoolChip(seeded)}
          tint="slate"
          detail={seededDetail}
        />
        <StatusRow
          name="Active (Google pulse)"
          on={operating === true}
          chip={statusBoolChip(operating)}
          tint="teal"
          detail={operatingDetail}
          action={<ActiveToggle place={place} operating={operating} />}
        />
        <StatusRow
          name="Listed"
          on={listed === true}
          chip={statusBoolChip(listed)}
          tint="indigo"
          detail={listedDetail}
          action={<ListedToggle place={place} listed={listed} />}
        />
        <StatusRow
          name="Requested"
          on={requestCount !== "unknown" && requestCount > 0}
          chip={requestCountChip(place.request_count)}
          tint="indigo"
          detail={requestedDetail}
        />
        <StatusRow
          name="Enriched"
          on={enriched === true}
          chip={statusBoolChip(enriched)}
          tint="violet"
          detail={enrichedDetail}
        />
        <StatusRow
          name="Enriching"
          on={enriching}
          chip={statusBoolChip(enriching)}
          tint="violet"
          detail={enrichingDetail}
        />
        <StatusRow
          name="Verified"
          on={verified === true}
          chip={statusBoolChip(verified)}
          tint="emerald"
          detail={verifiedDetail}
        />
        <StatusRow
          name="Partnered"
          on={partner}
          chip={statusBoolChip(partner)}
          tint="sky"
          detail={partnerDetail}
        />
        <StatusRow
          name="Promoted"
          on={promotingLevel > 0}
          chip={promotingLevelChip(promotingLevel)}
          tint="pink"
          detail={promotingDetail}
        />
        <StatusRow
          name="Mesita Pay"
          on={mesitaPay === true}
          chip={statusBoolChip(mesitaPay)}
          tint="amber"
          detail={mesitaPayDetail}
        />
        <StatusRow
          name="Accepts Yums"
          on={yums === true}
          chip={statusBoolChip(yums)}
          tint="orange"
          detail={yumsDetail}
        />
      </div>

      {badged !== promoting ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="type-label leading-relaxed text-amber-900">
            <span className="font-semibold">
              Guest surfaces disagree with Promoted.
            </span>{" "}
            {badged
              ? "projects.listing_type still says 'partner' while nothing is on offer, so the consumer app shows a reward badge over a closed promo lane."
              : "This place promotes a live discount but isn't stored as 'partner', so the consumer app gates the reward off and no guest can claim it."}
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}

function methodLabel(method: string): string {
  const clean = method.replace(/_/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function StatusRow({
  name,
  on,
  chip,
  tint,
  detail,
  action,
  children,
}: {
  name: string;
  on: boolean;
  /** `true`/`false`/`?`/`…` for bools, `0…n` for Requested, `0`/`1`/`2` for Promoted. */
  chip: string;
  tint: "slate" | "teal" | "indigo" | "violet" | "emerald" | "sky" | "pink" | "amber" | "orange";
  detail: string;
  /** Control under the detail. Active and Listed are the two operator writes. */
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const chipClass = {
    slate: "bg-slate-500/10 text-slate-700",
    teal: "bg-teal-500/10 text-teal-700",
    indigo: "bg-indigo-500/10 text-indigo-700",
    violet: "bg-violet-500/10 text-violet-700",
    emerald: "bg-emerald-500/10 text-emerald-700",
    sky: "bg-sky-500/10 text-sky-700",
    pink: "bg-pink-500/10 text-pink-600",
    amber: "bg-amber-500/10 text-amber-700",
    orange: "bg-orange-500/10 text-orange-700",
  }[tint];

  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <span className="text-foreground/90 type-body font-medium">{name}</span>
        <p className="text-foreground/70 mt-1 type-label font-medium">{detail}</p>
        {children}
        {action ? <div className="mt-2.5">{action}</div> : null}
      </div>
      <span
        className={
          "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 type-label font-semibold tabular-nums " +
          (on ? chipClass : "bg-muted text-muted-foreground")
        }
        aria-label={`${name}: ${chip}`}
      >
        {chip}
      </span>
    </div>
  );
}


/**
 * Active is the operator override of business_status. Off also unlists
 * (admin-web-set-place-active). On writes OPERATIONAL and does not list.
 * Confirm the off direction — guests disappear with the unlist.
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
        title="Mark inactive and unlist?"
        danger
        busy={pending}
        confirmLabel="Mark inactive"
        body={
          <p>
            {place.name} is marked closed, and guests stop finding it
            everywhere at once — browse, search, the swipe deck, and any
            link already shared. Re-listing is a separate write.
          </p>
        }
        onCancel={() => setConfirming(false)}
        onConfirm={() => apply(false)}
      />
    </>
  );
}

/**
 * Listed writes projects.status through admin-web-set-place-listed.
 * Unlisting is confirmed rather than immediate: the consumer RLS policy
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
  // Offering a toggle there would let one click write a status derived from a
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
        {listed ? "Unlist from Mesita" : "List on Mesita"}
      </button>
      {error ? <ErrorNote message={error} /> : null}

      <ConfirmDialog
        open={confirming}
        title="Unlist this place?"
        danger
        busy={pending}
        confirmLabel="Unlist"
        body={
          <p>
            Guests stop finding {place.name} everywhere at once — browse,
            search, the swipe deck, and any link already shared. Tickets and
            history are untouched, and you can list it again whenever you want.
          </p>
        }
        onConfirm={() => apply(false)}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
