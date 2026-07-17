import type { PlaceRow } from "./recommender-pool.ts";

export type ProposedCategory = {
  key: string;
  label: string;
  description: string;
  emoji: string;
  intent_query: string;
};

// Used if the LLM proposal fails: bucket by Google primary category.
export function fallbackCategories(rows: PlaceRow[], maxCategories: number): ProposedCategory[] {
  const byCat = new Map<string, PlaceRow[]>();
  for (const r of rows) {
    const c = (r.category ?? "").toLowerCase().trim();
    if (!c) continue;
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(r);
  }
  return [...byCat.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxCategories)
    .map(([cat]) => ({
      key: slug(cat),
      label: cat.charAt(0).toUpperCase() + cat.slice(1),
      description: `Top ${cat} places nearby`,
      emoji: "✨",
      intent_query: `${cat} places with great vibe and worth the visit`,
    }));
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function pickEmoji(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "✨";
  const it = raw[Symbol.iterator]();
  const first = it.next();
  return first.done ? "✨" : (first.value as string);
}

export function clampInt(v: unknown, def: number, lo: number, hi: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}
