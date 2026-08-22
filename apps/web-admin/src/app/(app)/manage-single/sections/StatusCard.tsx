// Status — where a place stands, in ONE box.
//
// Six facts, each read from its own source: seeded · listed · enriched ·
// verified · partner · promoting.
//
// NAMING (Pato, 2026-08-22). This box was Status, became Pulse in MESITA-1161
// to stop "status" colliding with `places.status`, and is Status again — because
// PULSE now names something else: the enrichment pipeline and its steps. One
// word, one meaning, and the collision with `places.status` is handled the way
// it should have been, by the row's own detail line naming the column value
// rather than by renaming the box.

import { AlertTriangle, CircleCheck } from "lucide-react";
import { type AdminPlace } from "../actions";
import { SectionCard } from "../ui";
import {
  effectiveStrikeCount,
  isMemberPlan,
  membershipPillState,
} from "./promo-state";
import { strategyForPlace } from "@/lib/business/strategies";

// Pato: "i don't want lots of fucking boxes. just create a box called Status.
// it mention verified, partner, promoting." They were three cards; they are
// rows, because they are answers to one question — where does this place
// stand.
//
//   Seeded     a google_place_id exists. Nothing enriches without it.
//   Listed     a guest can reach the place AT ALL. projects.status ∈
//              (active, lead) is what the consumer RLS policy
//              projects_select_public_visible gates on — its content_status
//              leg is a tautology (all four labels of the enum are allowed),
//              so status alone decides. Product Rules §B is right that Listed
//              is not a RUNG — nothing progresses through it — but it is not a
//              constant either: archive a place and every guest surface stops
//              resolving it. Today it is true for every row only because
//              nothing writes any status but 'active'.
//   Enriched   HOW FAR the Enricher got, 0-3, off place_research. A level, not
//              a yes.
//   Verified   somebody proved they own it. One-time, never lapses.
//   Partner    the place pays Mesita. A deal: stable, internal.
//   Promoting  a guest gets a discount here RIGHT NOW. Volatile, and the only
//              one of the six a guest is ever shown.
//
// Seeded, Listed and Enriched arrive computed on the super-admin overview
// payload (business-web-get-overview → _shared/place-status.ts), the same
// helpers the Single Place table uses, so the box and the table can never
// disagree. Partner and Promoting are derived here from columns on the row;
// Verified is a separate admin read hoisted into AdminSection.
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

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  ultra: "Ultra",
};

// The 0-3 enrich level in the box's voice. The Single Place table shows the
// same ladder as three ticks (LEVEL_TITLE in PlaceSelectCatalog).
const ENRICH_STEP: Record<0 | 1 | 2 | 3, string> = {
  0: "Nothing gathered — the pipeline has never finished a stage here.",
  1: "Research gathered. Images not analysed yet.",
  2: "Images analysed. The profile isn't written yet.",
  3: "Profile persisted — the Enricher finished.",
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
  const listed: boolean | "unknown" =
    typeof place.listed === "boolean" ? place.listed : "unknown";
  // The PULSE high-water, 0-9 (MESITA-1172) — the SAME number the catalog
  // table shows, from the same helper, so the two screens cannot disagree.
  // Falls back to the coarse 0-3 stage level only when the payload predates
  // piece reporting entirely.
  const pulse = typeof place.enrich_pulse === "number" ? place.enrich_pulse : null;
  const pulseTotal = typeof place.enrich_pulse_total === "number"
    ? place.enrich_pulse_total
    : 9;
  const level = typeof place.enrich_level === "number" ? place.enrich_level : null;
  const placeStatus = typeof place.status === "string" ? place.status : null;

  const seededDetail =
    seeded === "unknown"
      ? "Couldn't read the identity spine."
      : seeded
        ? "Google's place id is on the row — the pipeline has something to start from."
        : "No google_place_id. Nothing can enrich this place until one lands.";

  const listedDetail =
    listed === "unknown"
      ? "Couldn't read the place's status."
      : placeStatus === "active"
        ? "active — on every consumer surface, and in the discovery pool."
        : placeStatus === "lead"
          ? "lead — reachable by link and by search, but discovery pools active places only."
          : placeStatus
            ? `${placeStatus} — no guest surface resolves this place; the RLS policy stops the read.`
            : "No status on the row.";

  const enrichedDetail =
    level === null
      ? "Couldn't read the pipeline row."
      : ENRICH_STEP[level] +
        (place.enriched_at
          ? ` · last run ${String(place.enriched_at).slice(0, 10)}`
          : "");

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

  const promotingDetail =
    strategy === null
      ? "Custom rates — no preset strategy."
      : strategy === "zero"
        ? "Zero strategy — no discount offered."
        : state === "paused"
          ? "Lane paused — the strategy is set but nothing is claimable."
          : state === "forfeited"
            ? "Lane closed after three strikes."
            : !partner
              ? "No paid plan, so no discount resolves."
              : `${strategy.charAt(0).toUpperCase() + strategy.slice(1)} strategy, lane open.`;

  return (
    <SectionCard
      icon={<CircleCheck className="h-4 w-4" />}
      tint="emerald"
      title="Status"
    >
      <div className="mt-5 flex flex-col">
        <StatusRow
          name="Seeded"
          value={seeded}
          tint="slate"
          detail={seededDetail}
        />
        <StatusRow
          name="Listed"
          value={listed}
          tint="indigo"
          detail={listedDetail}
        />
        <StatusRow
          name="Enriched"
          value={pulse === pulseTotal}
          tint="violet"
          chipLabel={pulse === null ? undefined : `${pulse}/${pulseTotal}`}
          detail={enrichedDetail}
        />
        <StatusRow
          name="Verified"
          value={verified}
          tint="emerald"
          detail={verifiedDetail}
        />
        <StatusRow
          name="Partner"
          value={partner}
          tint="sky"
          detail={partnerDetail}
        />
        <StatusRow
          name="Promoting"
          value={promoting}
          tint="pink"
          detail={promotingDetail}
        />
      </div>

      {badged !== promoting ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <p className="text-[11px] leading-relaxed text-amber-900">
            <span className="font-semibold">
              Guest surfaces disagree with Promoting.
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
  value,
  tint,
  detail,
  chipLabel,
}: {
  name: string;
  value: boolean | "unknown" | "loading";
  tint: "slate" | "indigo" | "violet" | "emerald" | "sky" | "pink";
  detail: string;
  /** Overrides the chip text in BOTH states. Enriched is a 0-3 level, not a
   *  yes, so its chip reads "2/3" whether or not the level is complete. */
  chipLabel?: string;
}) {
  const on = value === true;
  const chipClass = {
    slate: "bg-slate-500/10 text-slate-700",
    indigo: "bg-indigo-500/10 text-indigo-700",
    violet: "bg-violet-500/10 text-violet-700",
    emerald: "bg-emerald-500/10 text-emerald-700",
    sky: "bg-sky-500/10 text-sky-700",
    pink: "bg-pink-500/10 text-pink-600",
  }[tint];

  return (
    <div className="border-border/60 flex items-start justify-between gap-4 border-b py-3.5 first:pt-0 last:border-b-0 last:pb-0">
      <div className="min-w-0">
        <span className="text-foreground/90 text-[13px] font-medium">{name}</span>
        <p className="text-foreground/70 mt-1 text-[11px] font-medium">{detail}</p>
      </div>
      <span
        className={
          "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tabular-nums " +
          (on ? chipClass : "bg-muted text-muted-foreground")
        }
        aria-label={`${name}: ${
          value === "loading"
            ? "checking"
            : value === "unknown"
              ? "unknown"
              : (chipLabel ?? (on ? "yes" : "no"))
        }`}
      >
        {value === "loading"
          ? "…"
          : value === "unknown"
            ? "?"
            : (chipLabel ?? (on ? name : "—"))}
      </span>
    </div>
  );
}
