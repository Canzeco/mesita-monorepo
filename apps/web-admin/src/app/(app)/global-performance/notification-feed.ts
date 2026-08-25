import type { NotificationItem, NotificationType } from "./actions";
import { TYPE_ORDER } from "./notification-config";

// View-model for Global Monitor. The EF already filters by category/types;
// this file is the operator-facing fold: domain labels, which types to
// fetch, pin reports, collapse consecutive Intaker steps.

export const STEP_TYPE = "atlas.enrichment_step" satisfies NotificationType;
export const REPORT_TYPE = "rewards.ticket_reported" satisfies NotificationType;

export type DomainKey =
  | "all"
  | "atlas"
  | "consumer"
  | "rewards"
  | "reservations";

export const DOMAINS: ReadonlyArray<{ key: DomainKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "atlas", label: "Intake" },
  { key: "consumer", label: "Guests" },
  { key: "rewards", label: "Promos" },
  { key: "reservations", label: "Reservations" },
];

export const TYPES_WITHOUT_STEPS: NotificationType[] = TYPE_ORDER.filter(
  (t) => t !== STEP_TYPE,
);

export function typesInDomain(
  domain: DomainKey,
  allowed: readonly NotificationType[] = TYPE_ORDER,
): NotificationType[] {
  return allowed.filter((t) => domain === "all" || t.startsWith(`${domain}.`));
}

/** Types to send to the EF. Empty array means "do not pass `types`" (all). */
export function typesForFetch(
  domain: DomainKey,
  includeSteps: boolean,
  allowed: readonly NotificationType[] = TYPE_ORDER,
): NotificationType[] | undefined {
  const inDomain = typesInDomain(domain, allowed);
  const next = includeSteps
    ? inDomain
    : inDomain.filter((t) => t !== STEP_TYPE);
  if (next.length === 0) return undefined;
  if (next.length === inDomain.length && domain !== "all") return undefined;
  if (includeSteps && domain === "all" && next.length === allowed.length) {
    return undefined;
  }
  return next;
}

export type FeedEntry =
  | { kind: "single"; item: NotificationItem }
  | { kind: "steps"; items: NotificationItem[] };

export function pinReports(items: NotificationItem[]): {
  reports: NotificationItem[];
  rest: NotificationItem[];
} {
  const reports: NotificationItem[] = [];
  const rest: NotificationItem[] = [];
  for (const item of items) {
    if (item.type === REPORT_TYPE) reports.push(item);
    else rest.push(item);
  }
  return { reports, rest };
}

export function groupConsecutiveSteps(items: NotificationItem[]): FeedEntry[] {
  const out: FeedEntry[] = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    if (item.type !== STEP_TYPE) {
      out.push({ kind: "single", item });
      i += 1;
      continue;
    }
    const placeId = item.place?.id ?? null;
    const cluster: NotificationItem[] = [item];
    let j = i + 1;
    while (j < items.length) {
      const next = items[j];
      if (next.type !== STEP_TYPE) break;
      if ((next.place?.id ?? null) !== placeId) break;
      cluster.push(next);
      j += 1;
    }
    if (cluster.length === 1) out.push({ kind: "single", item });
    else out.push({ kind: "steps", items: cluster });
    i = j;
  }
  return out;
}

export function feedEntryKey(entry: FeedEntry): string {
  if (entry.kind === "single") return entry.item.id;
  return `steps:${entry.items[0]?.id ?? "empty"}`;
}

export function groupHasFailure(items: NotificationItem[]): boolean {
  return items.some((item) => item.meta?.status === "failed");
}

export function reportReasonLabel(meta: Record<string, unknown>): string | null {
  const REPORT_REASON: Record<string, string> = {
    discount_refused: "Discount refused",
    closed_without_honoring: "Closed without honoring",
    qr_not_scanned: "QR never scanned",
    other: "Other",
  };
  if (typeof meta.reason !== "string") return null;
  return REPORT_REASON[meta.reason] ?? meta.reason;
}

// Status — the seven facts the Status box lists left to right:
//   seeded · active · listed · enriched · verified · partner · promoting
// Active is Google OPERATIONAL. Enriched is PULSE complete (n/9).
// `listing_type` backs NONE of them. `meta.claimed` is not Verified.

export const LISTED_STATUSES: readonly string[] = ["active", "lead"];

export function isListedStatus(status: unknown): boolean {
  return typeof status === "string" && LISTED_STATUSES.includes(status);
}

export type StatusFactKey =
  | "seeded"
  | "active"
  | "listed"
  | "enriched"
  | "verified"
  | "partner"
  | "promoting";

export const STATUS_FACTS: ReadonlyArray<{
  key: StatusFactKey;
  label: string;
}> = [
  { key: "seeded", label: "Seeded" },
  { key: "active", label: "Active" },
  { key: "listed", label: "Listed" },
  { key: "enriched", label: "Enriched" },
  { key: "verified", label: "Verified" },
  { key: "partner", label: "Partner" },
  { key: "promoting", label: "Promoting" },
];

export type PlaceStatusFacts = {
  seeded: boolean;
  active: boolean;
  listed: boolean;
  enriched: boolean;
  enrichPulse: number;
  enrichPulseTotal: number;
  verified: boolean;
  partner: boolean;
  promoting: boolean;
};

export function readStatusFacts(
  meta: Record<string, unknown> | undefined,
): PlaceStatusFacts | null {
  const raw = meta?.statusFacts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const f = raw as Record<string, unknown>;
  const bool = (v: unknown) => v === true;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    seeded: bool(f.seeded),
    active: bool(f.active),
    listed: bool(f.listed),
    enriched: bool(f.enriched),
    enrichPulse: num(f.enrichPulse),
    enrichPulseTotal: num(f.enrichPulseTotal) || 9,
    verified: bool(f.verified),
    partner: bool(f.partner),
    promoting: bool(f.promoting),
  };
}

export type IntakeFactChip = {
  key: StatusFactKey;
  label: string;
  on: boolean;
};

/** All seven facts for expand chips. */
export function intakeFactChips(item: NotificationItem): IntakeFactChip[] {
  const facts = readStatusFacts(item.meta);
  if (!facts) return [];
  return STATUS_FACTS.map((def) => ({
    key: def.key,
    on: facts[def.key],
    label:
      def.key === "enriched" && !facts.enriched
        ? `${facts.enrichPulse}/${facts.enrichPulseTotal}`
        : def.label,
  }));
}

/**
 * Compact Intake verb: every TRUE fact, Status-box order. Incomplete
 * enrichment still prints n/9 so that fact is never silent.
 */
export function intakeStatusLine(item: NotificationItem): string | null {
  const facts = readStatusFacts(item.meta);
  if (facts) {
    const parts: string[] = [];
    if (facts.seeded) parts.push("Seeded");
    if (facts.active) parts.push("Active");
    if (facts.listed) parts.push("Listed");
    if (facts.enriched) parts.push("Enriched");
    else parts.push(`${facts.enrichPulse}/${facts.enrichPulseTotal}`);
    if (facts.verified) parts.push("Verified");
    if (facts.partner) parts.push("Partner");
    if (facts.promoting) parts.push("Promoting");
    return parts.join(" · ");
  }
  // Pre-payload fallback (create events only carried status/enriched).
  if (item.type === "atlas.place_created") {
    const parts = ["Seeded"];
    if (isListedStatus(item.meta?.status)) parts.push("Listed");
    else if (typeof item.meta?.status === "string") parts.push("Unlisted");
    if (item.meta?.enriched === true) parts.push("Enriched");
    return parts.join(" · ");
  }
  if (item.type === "atlas.place_enriched") return "Enriched";
  if (item.type === "atlas.ownership_claimed") return "Verified";
  return null;
}

export function itemHasStatusFact(
  item: NotificationItem,
  key: StatusFactKey,
): boolean {
  const facts = readStatusFacts(item.meta);
  return facts ? facts[key] : false;
}

export function statusFactCounts(
  items: NotificationItem[],
): Record<StatusFactKey, number> {
  const counts = Object.fromEntries(
    STATUS_FACTS.map((f) => [f.key, 0]),
  ) as Record<StatusFactKey, number>;
  for (const item of items) {
    const facts = readStatusFacts(item.meta);
    if (!facts) continue;
    for (const def of STATUS_FACTS) {
      if (facts[def.key]) counts[def.key] += 1;
    }
  }
  return counts;
}

/** Category is a taxonomy, not a status — keep it off Intake compact lines. */
export function showCategoryOnCompact(item: NotificationItem): boolean {
  return !item.type.startsWith("atlas.");
}
