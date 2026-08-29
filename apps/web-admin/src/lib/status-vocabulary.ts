// Status — two boxes (Pato, 2026-08-25).
//
//   STATUSES (9)  Created · Active · Listed · Requested · Enriched ·
//                 Enriching · Verified · Partnered are bools (`true` /
//                 `false`). Promoted is 0 | 1 | 2. Requested is guest
//                 demand (count > 0, not ready), never a projects.status.
//   INTAKE (11)   own box: 0. Seed … 10. Semantic, each a bool: called or not
//
// Repeating the row name on the chip is redundant. Enriching is the live run;
// Enriched is last-completed — they are independent. Intake just names the
// eleven functions. Create 1–4 / Enrich 1–10 stay Config sequences; they are
// not a third Status ladder. Wire key `seeded` stays; the label is Created.

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
] as const;

export type GeneralStatusKey = (typeof GENERAL_STATUS_FACTS)[number]["key"];

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
  { key: "semantic", label: "Semantic", n: 10 },
] as const;

export type IntakeFunctionKey = (typeof INTAKE_FUNCTIONS)[number]["key"];

export const GENERAL_STATUS_COUNT = GENERAL_STATUS_FACTS.length;
export const INTAKE_FUNCTION_COUNT = INTAKE_FUNCTIONS.length;

/** Operator label: `0. Seed` … `10. Semantic`. */
export function intakeFunctionLabel(n: number, label: string): string {
  return `${n}. ${label}`;
}
