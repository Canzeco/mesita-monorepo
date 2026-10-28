// The Mesita families an operator saves from Single Place › Basics
// (MESITA-2893). Pato, 2026-10-27: "the families are always with an LLM, max
// 5 … the places actually save their family." The Description step infers
// them (MESITA-2891); this is the one hand-edit path, and what it accepts is
// pinned here because a refused or silently trimmed list is an operator's
// work lost.
//
// `family_keys` on the body: null or [] clears (the place reads Undefined and
// nobody owns the field); otherwise 1–FAMILIES_MAX slugs of the live
// place_families, deduplicated and returned in catalog (day-arc) order, the
// order every other writer stores (gate d27a). An unknown slug names itself
// in the 400 so a stale page can be reloaded, not guessed at.

import type { PlaceFamily } from "../_shared/categories.ts";
import { FAMILIES_MAX } from "../_shared/families-infer.ts";

export type FamilyKeysRefusal = {
  ok: false;
  code: "invalid_family_keys" | "too_many_families" | "unknown_family";
  error: string;
  fix?: string;
  slugs?: string[];
};

export type FamilyKeysRead =
  | { ok: true; keys: string[] | null }
  | { ok: false; status: 400; body: FamilyKeysRefusal };

export function readFamilyKeysBody(
  raw: unknown,
  families: readonly PlaceFamily[],
): FamilyKeysRead {
  if (raw === null || raw === undefined) return { ok: true, keys: null };
  if (!Array.isArray(raw)) {
    return refuse({
      code: "invalid_family_keys",
      error: "family_keys must be a list of family slugs, or null to clear",
    });
  }
  const picked = [...new Set(
    raw.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean),
  )];
  if (picked.length === 0) return { ok: true, keys: null };
  if (picked.length > FAMILIES_MAX) {
    return refuse({
      code: "too_many_families",
      error: `at most ${FAMILIES_MAX} families`,
      fix: `Keep the ${FAMILIES_MAX} that matter most.`,
    });
  }
  const order = new Map(
    families.filter((f) => f.slug !== "undefined").map((f) => [f.slug, f.sort_order] as const),
  );
  const unknown = picked.filter((slug) => !order.has(slug));
  if (unknown.length > 0) {
    return refuse({
      code: "unknown_family",
      error: `unknown family: ${unknown.join(", ")}`,
      fix: "Reload the page to refresh the list.",
      slugs: unknown,
    });
  }
  const keys = [...picked].sort((a, b) =>
    (order.get(a) ?? 0) - (order.get(b) ?? 0) || a.localeCompare(b)
  );
  return { ok: true, keys };
}

function refuse(body: Omit<FamilyKeysRefusal, "ok">): FamilyKeysRead {
  return { ok: false, status: 400, body: { ok: false, ...body } };
}
