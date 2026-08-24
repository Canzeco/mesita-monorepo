// Pure place-tag sanitizers: exclusive-group conflict resolution + top-N pick.
// Extracted from tags.ts (no I/O).

import { ENRICH_FIELD_LIMITS } from "./enrich-field-limits.ts";

const MAX_INFERRED_TAGS = ENRICH_FIELD_LIMITS.tagsPerPlace.max;

// Mutually exclusive slug groups. When more than one member appears on a place,
// keep the first-seen slug (LLM order ≈ confidence; business picker order ≈
// last toggle) and drop the rest. Compatible co-tags stay (e.g. online_booking
// + usually_a_wait with any booking policy).
const TAG_EXCLUSIVE_GROUPS: readonly (readonly string[])[] = [
  // Booking policy — "reservations required" vs "walk-ins / no reservation".
  // accepts_reservations is the soft middle and also conflicts with both poles.
  ["reservations_required", "walk_ins_welcome", "accepts_reservations"],
  // Payment: cash_only conflicts with each other tender pairwise so cards +
  // contactless can still coexist. Plain `cash` may sit alongside cards.
  ["cash_only", "cards"],
  ["cash_only", "contactless"],
  ["cash_only", "meal_vouchers"],
  // Vibe poles
  ["quiet", "lively"],
  ["casual", "upscale"],
  // Dress poles (smart_casual may coexist with either extreme in real life,
  // but casual_dress + formal_dress is nonsense).
  ["casual_dress", "formal_dress"],
  // Crowd: adults-only vs family-oriented
  ["adults_only", "family_friendly", "families", "kids_menu", "kids_activity", "all_ages"],
];

// Drops contradictory catalog tags. Preserves input order; within each
// exclusive group keeps the first slug encountered and blocks the rest.
// Safe to call on already-clean lists (idempotent). Used by Intaker
// inference and business tag writes.
export function sanitizePlaceTags(slugs: readonly string[]): string[] {
  if (slugs.length === 0) return [];
  const blocked = new Set<string>();
  const out: string[] = [];
  for (const slug of slugs) {
    if (!slug || blocked.has(slug)) continue;
    out.push(slug);
    for (const group of TAG_EXCLUSIVE_GROUPS) {
      if (!group.includes(slug)) continue;
      for (const other of group) {
        if (other !== slug) blocked.add(other);
      }
    }
  }
  return out;
}

// Takes a best-first ranked slug list and returns exactly `limit` conflict-free
// tags (or fewer only when the catalog itself cannot supply that many). Used by
// Intaker so every place gets a full tag set — always the strongest matches.
export function selectTopPlaceTags(
  rankedSlugs: readonly string[],
  limit: number = MAX_INFERRED_TAGS,
): string[] {
  if (limit <= 0 || rankedSlugs.length === 0) return [];
  return sanitizePlaceTags(rankedSlugs).slice(0, limit);
}
