import {
  ENGINELESS_STATUS_FACT_KEYS,
  GENERAL_STATUS_FACTS,
  INTAKE_FUNCTIONS,
  intakeFunctionLabel,
  type GeneralStatusKey,
  type IntakeFunctionKey,
} from "@/lib/status-vocabulary";
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
  { key: "rewards", label: "Rewards" },
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

// Status — two boxes (Pato, 2026-08-25 · acceptance bits 2026-08-29):
//   STATUSES (11) nine bools + Requested 0…n + Promoted 0|1|2. Compact
//                 line still names the true facts; Promoted here is the
//                 live-discount yes. Requested in this feed is count > 0.
//                 Mesita Pay / Mesita Credits are acceptance intent bits — no
//                 event stamper writes them yet, so their filter segments and
//                 meta chips stay filtered out (the engine PRs lift that).
//   INTAKE (11)   0. Seed … 10. Embedding — each a bool, called or not
// Enriched is a yes. Wire key `seeded`. `listing_type` backs NONE of them.

export const LISTED_STATUSES: readonly string[] = ["active", "lead"];

function isListedStatus(status: unknown): boolean {
  return typeof status === "string" && LISTED_STATUSES.includes(status);
}

export type StatusFactKey = GeneralStatusKey;
export const STATUS_FACTS = GENERAL_STATUS_FACTS;
export { INTAKE_FUNCTIONS };
export type { IntakeFunctionKey };

export type IntakeFilter =
  | "all"
  | StatusFactKey
  | `fn:${IntakeFunctionKey}`;

export type PlaceStatusFacts = {
  seeded: boolean;
  active: boolean;
  listed: boolean;
  requested: boolean;
  enriching: boolean;
  enriched: boolean;
  enrichPulse: number;
  enrichPulseTotal: number;
  verified: boolean;
  partner: boolean;
  promoting: boolean;
  mesita_pay: boolean;
  credits: boolean;
  functions: Record<string, boolean>;
};

function readStatusFacts(
  meta: Record<string, unknown> | undefined,
): PlaceStatusFacts | null {
  const raw = meta?.statusFacts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const f = raw as Record<string, unknown>;
  const bool = (v: unknown) => v === true;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const functions: Record<string, boolean> = {};
  if (f.functions && typeof f.functions === "object" && !Array.isArray(f.functions)) {
    for (const [k, v] of Object.entries(f.functions as Record<string, unknown>)) {
      if (v === true) functions[k] = true;
      else if (v && typeof v === "object" && !Array.isArray(v)) {
        const status = (v as { status?: unknown }).status;
        if (status === "completed" || status === "failed") functions[k] = true;
      }
    }
  }
  return {
    seeded: bool(f.seeded),
    active: bool(f.active),
    listed: bool(f.listed),
    requested: bool(f.requested),
    enriching: bool(f.enriching),
    enriched: bool(f.enriched),
    enrichPulse: num(f.enrichPulse),
    enrichPulseTotal: num(f.enrichPulseTotal) || 10,
    verified: bool(f.verified),
    partner: bool(f.partner),
    promoting: bool(f.promoting),
    // Acceptance bits: no stamper writes them yet — false until the engine
    // PRs add `mesita_pay` / `credits` to the event statusFacts payloads.
    mesita_pay: bool(f.mesita_pay),
    credits: bool(f.credits),
    functions,
  };
}

// Function 10 is `embedding` (renamed from `semantic`, §8.4). Events are
// append-only history: old payloads stamp `semantic`, and pre-merge ones
// stamp `name` + `summary` — all fold into the one Embedding chip.
function embeddingOn(facts: PlaceStatusFacts): boolean {
  if (facts.functions.embedding === true) return true;
  if (facts.functions.semantic === true) return true;
  return facts.functions.name === true && facts.functions.summary === true;
}

function fnOn(facts: PlaceStatusFacts, key: string): boolean {
  if (key === "seed") return facts.seeded;
  if (key === "embedding") return embeddingOn(facts);
  return facts.functions[key] === true;
}

export type IntakeFactChip = {
  key: StatusFactKey;
  label: string;
  on: boolean;
};

/** The engine-backed facts for expand chips. The two acceptance bits are
 *  filtered out until an event stamper writes them (their chips would be
 *  permanently muted noise); the gateway / Credits PRs lift this. */
export function intakeFactChips(item: NotificationItem): IntakeFactChip[] {
  const facts = readStatusFacts(item.meta);
  if (!facts) return [];
  return STATUS_FACTS.filter(
    (def) => !(ENGINELESS_STATUS_FACT_KEYS as readonly string[]).includes(def.key),
  ).map((def) => ({
    key: def.key,
    on: facts[def.key],
    label: def.label,
  }));
}

/**
 * Compact Intake verb: every TRUE general fact, Status-box order.
 * Enriched is a bool — incomplete places just omit it.
 */
export function intakeStatusLine(item: NotificationItem): string | null {
  const facts = readStatusFacts(item.meta);
  if (facts) {
    const parts: string[] = [];
    if (facts.seeded) parts.push("Created");
    if (facts.active) parts.push("Active");
    if (facts.listed) parts.push("Listed");
    if (facts.requested) parts.push("Requested");
    if (facts.enriched) parts.push("Enriched");
    if (facts.enriching) parts.push("Enriching");
    if (facts.verified) parts.push("Verified");
    if (facts.partner) parts.push("Partnered");
    if (facts.promoting) parts.push("Visit Rewards");
    if (facts.mesita_pay) parts.push("Mesita Pay");
    if (facts.credits) parts.push("Mesita Credits");
    return parts.join(" · ");
  }
  // Pre-payload fallback (create events only carried status/enriched).
  if (item.type === "atlas.place_created") {
    const parts = ["Created"];
    if (isListedStatus(item.meta?.status)) parts.push("Listed");
    else if (typeof item.meta?.status === "string") parts.push("Unlisted");
    if (item.meta?.enriched === true) parts.push("Enriched");
    return parts.join(" · ");
  }
  if (item.type === "atlas.place_enriched") return "Enriched";
  if (item.type === "atlas.ownership_claimed") return "Verified";
  return null;
}

export function itemMatchesIntakeFilter(
  item: NotificationItem,
  filter: IntakeFilter,
): boolean {
  if (filter === "all") return true;
  const facts = readStatusFacts(item.meta);
  if (!facts) return false;
  if (filter.startsWith("fn:")) {
    return fnOn(facts, filter.slice("fn:".length));
  }
  return facts[filter as StatusFactKey];
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

export function intakeFunctionCounts(
  items: NotificationItem[],
): Record<IntakeFunctionKey, number> {
  const counts = Object.fromEntries(
    INTAKE_FUNCTIONS.map((f) => [f.key, 0]),
  ) as Record<IntakeFunctionKey, number>;
  for (const item of items) {
    const facts = readStatusFacts(item.meta);
    if (!facts) continue;
    for (const def of INTAKE_FUNCTIONS) {
      if (fnOn(facts, def.key)) counts[def.key] += 1;
    }
  }
  return counts;
}

export type IntakeFnChip = {
  key: IntakeFunctionKey;
  label: string;
  on: boolean;
};

export function intakeFunctionChips(item: NotificationItem): IntakeFnChip[] {
  const facts = readStatusFacts(item.meta);
  if (!facts) return [];
  return INTAKE_FUNCTIONS.map((def) => ({
    key: def.key,
    label: intakeFunctionLabel(def.n, def.label),
    on: fnOn(facts, def.key),
  }));
}

/** Category is a taxonomy, not a status — keep it off Intake compact lines. */
export function showCategoryOnCompact(item: NotificationItem): boolean {
  return !item.type.startsWith("atlas.");
}
