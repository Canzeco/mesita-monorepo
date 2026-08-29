// Status — two boxes (Pato, 2026-08-25 · 2026-08-29).
//
//   STATUSES (11) Created · Active · Listed · Enriched · Enriching ·
//                 Verified · Partnered · Mesita Pay · Accepts Yums are bools
//                 (`true` / `false`). Requested is the guest request count,
//                 0…n — not a Yes/No. Promoted is 0 | 1 | 2. Never a
//                 projects.status. Mesita Pay / Accepts Yums are per-place
//                 settlement-acceptance intent bits (places.mesita_pay_enabled
//                 / places.yums_enabled) — all false until their engines land.
//   INTAKE (11)   own box: 0. Seed … 10. Embedding, each a bool: called or not
//
// Repeating the row name on the chip is redundant. Enriching is the live run;
// Enriched is last-completed — they are independent. Intake just names the
// eleven functions. Create 1–5 / Enrich 1–10 stay Config sequences; they are
// not a third Status ladder. Wire key `seeded` stays; the label is Created.
// Function 10 was renamed `semantic` → `embedding` (§8.4); stored blobs and
// event payloads may still say `semantic` — readers fold, never rewrite.

export type StatusBoolChip = "true" | "false" | "?" | "…";

/** Chip for a binary Status fact. Loading and unknown stay distinct. */
export function statusBoolChip(
  value: boolean | "unknown" | "loading" | null | undefined,
): StatusBoolChip {
  if (value === "loading") return "…";
  if (value === "unknown" || value == null) return "?";
  return value ? "true" : "false";
}

/**
 * Operator Promoted: 0 Zero · 1 Conservative · 2 Aggressive.
 * Engine Dominant (3) displays as 2 — Promos already has three strategies.
 */
export function operatorPromotingLevel(
  raw: number | null | undefined,
): 0 | 1 | 2 {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : 0;
  if (n <= 0) return 0;
  if (n === 1) return 1;
  return 2;
}

export function promotingLevelChip(
  raw: number | null | undefined,
): "0" | "1" | "2" {
  return String(operatorPromotingLevel(raw)) as "0" | "1" | "2";
}

/** Guest request count. Missing is "?"; the Status fact is the number. */
export function requestCountFromRow(
  requestCount: unknown,
): number | "unknown" {
  if (requestCount == null || requestCount === "") return "unknown";
  const n = Number(requestCount);
  if (!Number.isFinite(n) || n < 0) return "unknown";
  return Math.trunc(n);
}

/** Chip for Requested: `0` · `1` · `12` · … or `?`. Never true/false. */
export function requestCountChip(requestCount: unknown): string {
  const n = requestCountFromRow(requestCount);
  return n === "unknown" ? "?" : String(n);
}

export const OPERATOR_PROMOTING_LABEL: Record<0 | 1 | 2, string> = {
  0: "Zero",
  1: "Conservative",
  2: "Aggressive",
};

/** Live strategy → operator 0|1|2. Dominant and custom rates display as 2. */
export function promotingLevelFromStrategy(
  live: boolean,
  strategy: string | null | undefined,
): 0 | 1 | 2 {
  if (!live) return 0;
  if (strategy === "conservative") return 1;
  return 2;
}

export const GENERAL_STATUS_FACTS = [
  { key: "seeded", label: "Created" },
  { key: "active", label: "Active" },
  { key: "listed", label: "Listed" },
  { key: "requested", label: "Requested" },
  { key: "enriched", label: "Enriched" },
  { key: "enriching", label: "Enriching" },
  { key: "verified", label: "Verified" },
  { key: "partner", label: "Partnered" },
  { key: "promoting", label: "Promoted" },
  { key: "mesita_pay", label: "Mesita Pay" },
  { key: "yums", label: "Accepts Yums" },
] as const;

export type GeneralStatusKey = (typeof GENERAL_STATUS_FACTS)[number]["key"];

/** Facts whose FALSE is a state, not a pending debt: grey pill, never rose.
 *  Same taxonomy as the catalog's BoolCell falseTone — a free place and a
 *  place that doesn't take a not-yet-live rail are not defects. */
export const STATUS_FACT_FALSE_TONE: Partial<Record<GeneralStatusKey, "neutral">> = {
  partner: "neutral",
  mesita_pay: "neutral",
  yums: "neutral",
};

/** Acceptance bits with NO engine yet (decision: Pato gate 2026-08-29).
 *  Header chips, Global Monitor filter segments and notification meta chips
 *  OMIT these until the Mesita Pay gateway / Yums Credits PRs lift the
 *  filters; the catalog table and the Status box still show them. */
export const ENGINELESS_STATUS_FACT_KEYS: readonly GeneralStatusKey[] = [
  "mesita_pay",
  "yums",
];

export const INTAKE_FUNCTIONS = [
  { key: "seed", label: "Seed", n: 0 },
  { key: "pulse", label: "Pulse", n: 1 },
  { key: "details", label: "Details", n: 2 },
  { key: "serp", label: "Serp", n: 3 },
  { key: "links", label: "Links", n: 4 },
  { key: "social", label: "Social", n: 5 },
  { key: "images", label: "Images", n: 6 },
  { key: "menu", label: "Menu", n: 7 },
  { key: "reviews", label: "Reviews", n: 8 },
  { key: "description", label: "Description", n: 9 },
  { key: "embedding", label: "Embedding", n: 10 },
] as const;

export type IntakeFunctionKey = (typeof INTAKE_FUNCTIONS)[number]["key"];

export const GENERAL_STATUS_COUNT = GENERAL_STATUS_FACTS.length;
export const INTAKE_FUNCTION_COUNT = INTAKE_FUNCTIONS.length;

/** Operator label: `0. Seed` … `10. Embedding`. */
export function intakeFunctionLabel(n: number, label: string): string {
  return `${n}. ${label}`;
}
