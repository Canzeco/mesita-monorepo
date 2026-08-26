// Pure Catalog rail picker. I/O (pool fetch, embeddings) stays in the EF.

import {
  CATALOG_RAILS_CAP,
  type CatalogConfig,
} from "./discovery-config.ts";
import type { VibeQuery } from "./catalog-vibe-queries.ts";

export type OccupiedCategory = {
  slug: string;
  label: string;
  count: number;
};

export type CatalogRailPlan = {
  key: string;
  label: string;
  source: "seed" | "generated";
  /** Atlas slug for seed rails; vibe query text for generated. */
  query: string;
};

export function shuffleInPlace<T>(items: T[], rng: () => number = Math.random): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j]!;
    items[j] = tmp!;
  }
  return items;
}

export function pickN<T>(items: readonly T[], n: number, rng: () => number = Math.random): T[] {
  if (n <= 0 || items.length === 0) return [];
  const copy = [...items];
  shuffleInPlace(copy, rng);
  return copy.slice(0, Math.min(n, copy.length));
}

export function occupiedFromRows(
  rows: ReadonlyArray<{ category: string | null; category_label?: string | null }>,
  minSeedPlaces: number,
): OccupiedCategory[] {
  const bySlug = new Map<string, OccupiedCategory>();
  for (const row of rows) {
    const slug = (row.category ?? "").trim();
    if (!slug || slug === "undefined") continue;
    const label = (row.category_label ?? slug).trim() || slug;
    const prev = bySlug.get(slug);
    if (prev) prev.count += 1;
    else bySlug.set(slug, { slug, label, count: 1 });
  }
  return [...bySlug.values()].filter((c) => c.count >= minSeedPlaces);
}

export function sliceSeedPlaces<T extends { category: string | null }>(
  rows: readonly T[],
  slug: string,
  limit: number,
  rng: () => number = Math.random,
): T[] {
  return pickN(
    rows.filter((r) => (r.category ?? "") === slug),
    limit,
    rng,
  );
}

export function planCatalogRails(
  cfg: CatalogConfig,
  occupied: OccupiedCategory[],
  vibeBank: readonly VibeQuery[],
  rng: () => number = Math.random,
): CatalogRailPlan[] {
  const seed = pickN(occupied, cfg.seedCount, rng).map((c) => ({
    key: `seed:${c.slug}`,
    label: c.label,
    source: "seed" as const,
    query: c.slug,
  }));
  const seedLabels = new Set(seed.map((r) => r.label.toLowerCase()));
  const bank = vibeBank.filter((q) => !seedLabels.has(q.label.toLowerCase()));
  const generated = pickN(bank, cfg.generatedCount, rng).map((q) => ({
    key: `gen:${q.key}`,
    label: q.label,
    source: "generated" as const,
    query: q.query,
  }));
  return [...seed, ...generated].slice(0, CATALOG_RAILS_CAP);
}

export function ilikeHaystack(row: {
  name?: string | null;
  vibe?: string | null;
  description?: string | null;
  category_label?: string | null;
}): string {
  return [row.name, row.vibe, row.description, row.category_label]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function matchIlike<T extends object>(
  rows: T[],
  query: string,
  limit: number,
): T[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2);
  if (tokens.length === 0) return rows.slice(0, limit);
  const scored = rows.map((row) => {
    const hay = ilikeHaystack(row as never);
    let hits = 0;
    for (const t of tokens) if (hay.includes(t)) hits += 1;
    return { row, hits };
  });
  scored.sort((a, b) => b.hits - a.hits);
  return scored.filter((s) => s.hits > 0).slice(0, limit).map((s) => s.row);
}
