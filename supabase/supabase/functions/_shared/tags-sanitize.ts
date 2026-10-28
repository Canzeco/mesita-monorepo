// Pure place-tag sanitizer: exclusive-group conflict resolution.
// Extracted from tags.ts (no I/O).

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
// Safe to call on already-clean lists (idempotent). Used by Enricher
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
