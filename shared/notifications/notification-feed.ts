import {
  ENGINELESS_STATE_FACT_KEYS,
  UNSTAMPED_STATE_FACT_KEYS,
  GENERAL_STATE_FACTS,
  INTAKE_FUNCTIONS,
  intakeFunctionLabel,
  type StampedStateFactKey,
  type IntakeFunctionKey,
} from "@/lib/state-vocabulary";
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
  return items.some((item) => item.meta?.state === "failed");
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

// State — two boxes (Pato, 2026-08-25 · acceptance bits 2026-08-29):
//   STATES (11)   nine bools + Requested 0…n + Promoted 0|1|2. Compact
//                 line still names the true facts; Promoted here is the
//                 live-discount yes. Requested in this feed is count > 0.
//                 Mesita Pay / Mesita Credits are acceptance intent bits — no
//                 event stamper writes them yet, so their filter segments and
//                 meta chips stay filtered out (the engine PRs lift that).
//   INTAKE (11)   0. Seed … 10. Embedding — each a bool, called or not
// Enriched is a yes. Wire key `seeded`. `listing_type` backs NONE of them.

export const LISTED_STATES: readonly string[] = ["active", "lead"];

function isListedState(state: unknown): boolean {
  return typeof state === "string" && LISTED_STATES.includes(state);
}

// Owned is in the State vocabulary but NOT in the notification payload, so it
// is not a key this feed can index — see UNSTAMPED_STATE_FACT_KEYS.
export type StateFactKey = StampedStateFactKey;
export const STATE_FACTS: readonly { key: StateFactKey; label: string }[] =
  GENERAL_STATE_FACTS.filter(
    (f) => !(UNSTAMPED_STATE_FACT_KEYS as readonly string[]).includes(f.key),
  ) as readonly { key: StateFactKey; label: string }[];
export { INTAKE_FUNCTIONS };
export type { IntakeFunctionKey };

export type IntakeFilter =
  | "all"
  | StateFactKey
  | `fn:${IntakeFunctionKey}`;

export type PlaceStateFacts = {
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

function readStateFacts(
  meta: Record<string, unknown> | undefined,
): PlaceStateFacts | null {
  const raw = meta?.stateFacts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const f = raw as Record<string, unknown>;
  const bool = (v: unknown) => v === true;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const functions: Record<string, boolean> = {};
  if (f.functions && typeof f.functions === "object" && !Array.isArray(f.functions)) {
    for (const [k, v] of Object.entries(f.functions as Record<string, unknown>)) {
      if (v === true) functions[k] = true;
      else if (v && typeof v === "object" && !Array.isArray(v)) {
        const state = (v as { state?: unknown }).state;
        if (state === "completed" || state === "failed") functions[k] = true;
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
    // PRs add `mesita_pay` / `credits` to the event stateFacts payloads.
    mesita_pay: bool(f.mesita_pay),
    credits: bool(f.credits),
    functions,
  };
}

// Function 10 is `embedding` (renamed from `semantic`, §8.4). Events are
// append-only history: old payloads stamp `semantic`, and pre-merge ones
// stamp `name` + `summary` — all fold into the one Embedding chip.
function embeddingOn(facts: PlaceStateFacts): boolean {
  if (facts.functions.embedding === true) return true;
  if (facts.functions.semantic === true) return true;
  return facts.functions.name === true && facts.functions.summary === true;
}

function fnOn(facts: PlaceStateFacts, key: string): boolean {
  if (key === "seed") return facts.seeded;
  if (key === "embedding") return embeddingOn(facts);
  return facts.functions[key] === true;
}

export type IntakeFactChip = {
  key: StateFactKey;
  label: string;
  on: boolean;
};

/** The engine-backed facts for expand chips. The two acceptance bits are
 *  filtered out until an event stamper writes them (their chips would be
 *  permanently muted noise); the gateway / Credits PRs lift this. */
export function intakeFactChips(item: NotificationItem): IntakeFactChip[] {
  const facts = readStateFacts(item.meta);
  if (!facts) return [];
  return STATE_FACTS.filter(
    (def) => !(ENGINELESS_STATE_FACT_KEYS as readonly string[]).includes(def.key),
  ).map((def) => ({
    key: def.key,
    on: facts[def.key],
    label: def.label,
  }));
}

/**
 * Compact Intake verb: every TRUE general fact, State-box order.
 * Enriched is a bool — incomplete places just omit it.
 */
export function intakeStateLine(item: NotificationItem): string | null {
  const facts = readStateFacts(item.meta);
  if (facts) {
    const parts: string[] = [];
    if (facts.seeded) parts.push("Created");
    if (facts.active) parts.push("Active");
    if (facts.listed) parts.push("Listed");
    if (facts.requested) parts.push("Requested");
    if (facts.enriching) parts.push("Enriching");
    if (facts.enriched) parts.push("Enriched");
    if (facts.verified) parts.push("Verified");
    if (facts.partner) parts.push("Partnered");
    if (facts.promoting) parts.push("Visit Rewards");
    if (facts.mesita_pay) parts.push("Mesita Pay");
    if (facts.credits) parts.push("Mesita Credits");
    return parts.join(" · ");
  }
  // Pre-payload fallback (create events only carried state/enriched).
  if (item.type === "atlas.place_created") {
    const parts = ["Created"];
    if (isListedState(item.meta?.state)) parts.push("Listed");
    else if (typeof item.meta?.state === "string") parts.push("Unlisted");
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
  const facts = readStateFacts(item.meta);
  if (!facts) return false;
  if (filter.startsWith("fn:")) {
    return fnOn(facts, filter.slice("fn:".length));
  }
  return facts[filter as StateFactKey];
}

export function stateFactCounts(
  items: NotificationItem[],
): Record<StateFactKey, number> {
  const counts = Object.fromEntries(
    STATE_FACTS.map((f) => [f.key, 0]),
  ) as Record<StateFactKey, number>;
  for (const item of items) {
    const facts = readStateFacts(item.meta);
    if (!facts) continue;
    for (const def of STATE_FACTS) {
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
    const facts = readStateFacts(item.meta);
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
  const facts = readStateFacts(item.meta);
  if (!facts) return [];
  return INTAKE_FUNCTIONS.map((def) => ({
    key: def.key,
    label: intakeFunctionLabel(def.n, def.label),
    on: fnOn(facts, def.key),
  }));
}

/** Category is a taxonomy, not a state — keep it off Intake compact lines. */
export function showCategoryOnCompact(item: NotificationItem): boolean {
  return !item.type.startsWith("atlas.");
}
