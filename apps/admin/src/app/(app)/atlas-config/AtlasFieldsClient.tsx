"use client";

import { useMemo } from "react";
import type { AtlasFieldsPayload } from "./actions";

export function AtlasFieldsClient({ data }: { data: AtlasFieldsPayload }) {
  const { categories, tags } = data;

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
      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold tracking-tight">Field limits</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Enforced in the business Place editor and business-update-project.
        </p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(data.fieldLimits).map(([key, limit]) => {
            // Tag catalog size is live DB state (place_tags row count), not the
            // static ENRICH_FIELD_LIMITS.tagCatalogSize constant — keep the card
            // loyal to what admin-web-get-atlas-fields actually returned.
            const max =
              key === "tagCatalogSize" ? data.counts.tags : limit.max;
            const note =
              key === "tagCatalogSize"
                ? `Live count in place_tags (${data.counts.tags})`
                : limit.note;
            return (
              <div
                key={key}
                className="border-border bg-background rounded-xl border px-4 py-3"
              >
                <dt className="text-sm font-medium">{humanizeKey(key)}</dt>
                <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
                  {formatLimit(key, max)}
                </dd>
                <dd className="text-muted-foreground mt-1 text-xs">{note}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">Categories</h2>
          <p className="text-muted-foreground text-xs">
            {data.counts.categories} total
          </p>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Canonical slugs in <code className="text-xs">place_categories</code>. ADEA
          inference picks from this list.
        </p>
        <div className="mt-5 flex flex-col gap-6">
          {Array.from(categoriesBySection.entries()).map(([section, rows]) => (
            <div key={section}>
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {section}
              </h3>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((c) => (
                  <li
                    key={c.slug}
                    className="border-border bg-background flex min-w-0 items-baseline gap-x-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{c.label}</span>
                    <code className="text-muted-foreground shrink-0 text-xs">{c.slug}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">Tags</h2>
          <p className="text-muted-foreground text-xs">
            {data.counts.tags} possible tags · up to{" "}
            {data.fieldLimits.tagsPerPlace?.max ?? 20} per place
          </p>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Controlled attribute slugs in <code className="text-xs">place_tags</code>, grouped
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
                <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((t) => (
                    <li
                      key={t.slug}
                      className="border-border bg-background flex min-w-0 flex-col gap-0.5 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="truncate font-medium">{t.label_en}</span>
                      <span className="text-muted-foreground flex min-w-0 items-baseline gap-x-2 text-xs">
                        <span className="min-w-0 truncate">{t.label_es}</span>
                        <code className="shrink-0">{t.slug}</code>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function humanizeKey(key: string): string {
  if (key === "tagsPerPlace") return "Tags per place";
  if (key === "tagCatalogSize") return "Tag catalog";
  if (key === "photos") return "Photos";
  if (key === "prWhatsappNumbers") return "PR WhatsApp numbers";
  if (key === "prInstagramAccounts") return "PR Instagram accounts";
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatLimit(key: string, max: number): string {
  const countKeys = new Set([
    "tagsPerPlace",
    "tagCatalogSize",
    "photos",
    "prWhatsappNumbers",
    "prInstagramAccounts",
  ]);
  if (key === "tagsPerPlace") return `Up to ${max.toLocaleString()}`;
  if (key === "photos") return `Up to ${max.toLocaleString()}`;
  if (key === "prWhatsappNumbers" || key === "prInstagramAccounts") {
    return `Up to ${max.toLocaleString()}`;
  }
  if (countKeys.has(key)) return max.toLocaleString();
  return `${max.toLocaleString()} chars`;
}
