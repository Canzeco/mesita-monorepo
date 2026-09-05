import type { PlaceEnrichmentStatus } from "./actions";
import {
  operatorPromotingLevel,
  promotingLevelChip,
  requestCountChip,
  requestCountFromRow,
  stateBoolChip,
} from "@/lib/state-vocabulary";

/** True while the Intaker pipeline is mid-flight.
 *  decision: Pato (MESITA-453) — Enriching = the WHOLE pipeline:
 *  research OR analysis OR contents. Never clear after research alone. */
export function isEnriching(status: PlaceEnrichmentStatus | null): boolean {
  const stage = status?.stage ?? null;
  if (stage === "research" || stage === "analysis" || stage === "contents") {
    return true;
  }
  const contentStatus = status?.content_status ?? null;
  return contentStatus === "generating" || contentStatus === "queued";
}

export function isEnrichFailed(status: PlaceEnrichmentStatus | null): boolean {
  return status?.stage === "failed";
}

export type HeaderFact = {
  key: string;
  label: string;
  on: boolean | "unknown";
  /** State-box chip (`true`/`false`/`0|1|2`/`0…n`). Header prints `label` only. */
  chip: string;
};

/** Same predicate as `_shared/place-status.ts::isPlaceListed` and the
 *  consumer RLS policy: only `active` and `lead` are reachable. */
export const LISTED_STATES = ["active", "lead"] as const;

export function listedFromState(status: unknown): boolean | "unknown" {
  if (typeof status !== "string" || status === "") return "unknown";
  return (LISTED_STATES as readonly string[]).includes(status);
}

/** Stamp `listed` from `status` so a merged write payload cannot keep a
 *  stale overview flag (Unlist wrote `paused` but left `listed: true`). */
export function withListedFromState<T extends { status?: unknown; listed?: boolean }>(
  place: T,
): T {
  const listed = listedFromState(place.status);
  if (listed === "unknown") return place;
  return { ...place, listed };
}

export function generalHeaderFacts(input: {
  seeded?: boolean;
  listed?: boolean;
  business_status?: string | null;
  /** Live Intaker run. Independent of Enriched (last-completed). */
  enriching?: boolean;
  requestCount?: number;
  enrich_pulse?: number;
  enrich_pulse_total?: number;
  partner: boolean;
  promoting?: boolean;
  promotingLevel?: number;
  verified: boolean | "unknown";
  /** places.mesita_pay_enabled — acceptance intent bit. Absent = unknown. */
  mesitaPay?: boolean;
  /** places.credits_enabled — acceptance intent bit. Absent = unknown. */
  credits?: boolean;
}): HeaderFact[] {
  const created: boolean | "unknown" =
    typeof input.seeded === "boolean" ? input.seeded : "unknown";
  const listed: boolean | "unknown" =
    typeof input.listed === "boolean" ? input.listed : "unknown";
  const active: boolean | "unknown" =
    input.business_status == null || input.business_status === ""
      ? "unknown"
      : input.business_status === "OPERATIONAL";
  const pulse = typeof input.enrich_pulse === "number" ? input.enrich_pulse : null;
  const total = typeof input.enrich_pulse_total === "number" ? input.enrich_pulse_total : null;
  const enriched: boolean | "unknown" =
    pulse === null || total === null || total === 0 ? "unknown" : pulse >= total;
  const level = operatorPromotingLevel(
    typeof input.promotingLevel === "number"
      ? input.promotingLevel
      : input.promoting
        ? 2
        : 0,
  );
  const enriching: boolean | "unknown" =
    typeof input.enriching === "boolean" ? input.enriching : "unknown";
  const requestCount = requestCountFromRow(input.requestCount);
  const requestedOn: boolean | "unknown" =
    requestCount === "unknown" ? "unknown" : requestCount > 0;
  const mesitaPay: boolean | "unknown" =
    typeof input.mesitaPay === "boolean" ? input.mesitaPay : "unknown";
  const credits: boolean | "unknown" =
    typeof input.credits === "boolean" ? input.credits : "unknown";
  return [
    { key: "seeded", label: "Created", on: created, chip: stateBoolChip(created) },
    { key: "active", label: "Active", on: active, chip: stateBoolChip(active) },
    { key: "listed", label: "Listed", on: listed, chip: stateBoolChip(listed) },
    {
      key: "requested",
      label: "Requested",
      on: requestedOn,
      chip: requestCountChip(input.requestCount),
    },
    { key: "enriched", label: "Enriched", on: enriched, chip: stateBoolChip(enriched) },
    { key: "enriching", label: "Enriching", on: enriching, chip: stateBoolChip(enriching) },
    {
      key: "verified",
      label: "Verified",
      on: input.verified,
      chip: stateBoolChip(input.verified),
    },
    {
      key: "partner",
      label: "Partnered",
      on: input.partner,
      chip: stateBoolChip(input.partner),
    },
    {
      key: "promoting",
      label: "Visit Rewards",
      on: level > 0,
      chip: promotingLevelChip(level),
    },
    {
      key: "mesita_pay",
      label: "Mesita Pay",
      on: mesitaPay,
      chip: stateBoolChip(mesitaPay),
    },
    {
      key: "credits",
      label: "Mesita Credits",
      on: credits,
      chip: stateBoolChip(credits),
    },
  ];
}

