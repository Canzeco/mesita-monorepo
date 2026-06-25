"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { AtlasFieldsPayload } from "./actions";

export function AtlasFieldsClient({ data }: { data: AtlasFieldsPayload }) {
  const [q, setQ] = useState("");

  const needle = q.trim().toLowerCase();
  const categories = useMemo(() => {
    if (!needle) return data.categories;
    return data.categories.filter(
      (c) =>
        c.slug.includes(needle) ||
        c.label.toLowerCase().includes(needle) ||
        c.section.toLowerCase().includes(needle),
    );
  }, [data.categories, needle]);

  const tags = useMemo(() => {
    if (!needle) return data.tags;
    return data.tags.filter(
      (t) =>
        t.slug.includes(needle) ||
        t.label_en.toLowerCase().includes(needle) ||
        t.label_es.toLowerCase().includes(needle) ||
        t.facet.includes(needle),
    );
  }, [data.tags, needle]);

  const categoriesBySection = useMemo(() => {
    const map = new Map<string, typeof categories>();
    for (const c of categories) {
      const list = map.get(c.section) ?? [];
      list.push(c);
      map.set(c.section, list);
    }
    return map;
  }, [categories]);

  const tagsByFacet = useMemo(() => {
    const map = new Map<string, typeof tags>();
    for (const t of tags) {
      const list = map.get(t.facet) ?? [];
      list.push(t);
      map.set(t.facet, list);
    }
    return map;
  }, [tags]);

  return (
    <div className="flex flex-col gap-8">
      <div className="border-border bg-background focus-within:border-foreground flex items-center gap-2 rounded-xl border px-3">
        <Search className="text-muted-foreground h-4 w-4 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Filter categories and tags…"
          className="h-10 flex-1 bg-transparent text-sm outline-none"
        />
      </div>

      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold tracking-tight">Field limits</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Enforced in the business Place editor and business-update-unit.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(data.fieldLimits).map(([key, limit]) => (
            <div
              key={key}
              className="border-border bg-background rounded-xl border px-4 py-3"
            >
              <dt className="text-sm font-medium">{humanizeKey(key)}</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {formatLimit(key, limit.max)}
              </dd>
              <dd className="text-muted-foreground mt-1 text-xs">{limit.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">Categories</h2>
          <p className="text-muted-foreground text-xs">
            {categories.length} shown · {data.counts.categories} total
          </p>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Canonical slugs in <code className="text-xs">venue_categories</code>. ADEA
          inference picks from this list.
        </p>
        <div className="mt-5 flex flex-col gap-6">
          {Array.from(categoriesBySection.entries()).map(([section, rows]) => (
            <div key={section}>
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {section}
              </h3>
              <ul className="mt-2 flex flex-col gap-1.5">
                {rows.map((c) => (
                  <li
                    key={c.slug}
                    className="border-border bg-background flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span>{c.label}</span>
                    <code className="text-muted-foreground text-xs">{c.slug}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {categories.length === 0 && (
            <p className="text-muted-foreground text-sm">No categories match.</p>
          )}
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">Tags</h2>
          <p className="text-muted-foreground text-xs">
            {tags.length} shown · {data.counts.tags} total · max{" "}
            {data.fieldLimits.tagsPerVenue?.max ?? 12} per venue
          </p>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Controlled attribute slugs in <code className="text-xs">venue_tags</code>, grouped
          by facet.
        </p>
        <div className="mt-5 flex flex-col gap-6">
          {data.facets.map((facet) => {
            const rows = tagsByFacet.get(facet.slug) ?? [];
            if (rows.length === 0) return null;
            return (
              <div key={facet.slug}>
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {facet.emoji} {facet.label_en}
                </h3>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {rows.map((t) => (
                    <li
                      key={t.slug}
                      className="border-border bg-background flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span>{t.label_en}</span>
                      <span className="text-muted-foreground text-xs">{t.label_es}</span>
                      <code className="text-muted-foreground text-xs">{t.slug}</code>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          {tags.length === 0 && (
            <p className="text-muted-foreground text-sm">No tags match.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatLimit(key: string, max: number): string {
  const countKeys = new Set(["tagsPerVenue", "photos", "prLinks"]);
  if (countKeys.has(key)) return max.toLocaleString();
  return `${max.toLocaleString()} chars`;
}
