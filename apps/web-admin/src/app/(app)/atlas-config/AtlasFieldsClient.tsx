"use client";

import { useMemo } from "react";
import { Collapsible } from "../enricher-config/atlas-ui";
import type { AtlasFieldsPayload } from "./actions";
import type { PlaceFieldPermission } from "./place-field-permissions";
import {
  PLACE_FIELD_PERMISSIONS,
  PLACE_FIELD_PERMISSION_GROUP_DESCRIPTIONS,
} from "./place-field-permissions";

export function AtlasFieldsClient({ data }: { data: AtlasFieldsPayload }) {
  const { categories, tags } = data;

  // Rows arrive grouped by ownership — keep that order rather than sorting.
  const permissionsByGroup = useMemo(() => {
    const map = new Map<
      PlaceFieldPermission["group"],
      PlaceFieldPermission[]
    >();
    for (const row of PLACE_FIELD_PERMISSIONS) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return map;
  }, []);

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
        <h2 className="font-display text-base font-semibold tracking-tight">
          Who can edit
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Place profile fields grouped by owner — who writes each one and who
          may correct it. Google-native fields are re-stamped on every enrich,
          so manual edits there don&apos;t stick. Read-only reference (not a
          live ACL toggle).
        </p>
        <Collapsible
          summary={`Show ${PLACE_FIELD_PERMISSIONS.length} fields · who can edit`}
        >
          <div className="flex max-w-3xl flex-col gap-6">
            {Array.from(permissionsByGroup.entries()).map(([group, rows]) => (
              <div key={group}>
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                  {group}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                  {PLACE_FIELD_PERMISSION_GROUP_DESCRIPTIONS[group]}
                </p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {rows.map((row) => (
                    <li key={row.key} className="text-sm leading-relaxed">
                      <span className="font-medium">{row.label}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        — {describePermission(row)}
                        {row.note ? ` ${row.note}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Collapsible>
      </section>

      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold tracking-tight">Field limits</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Profile-spec caps from the Enricher shared limits — enforced in the
          business Place editor / business-update-project, Place Synthesis
          embeddings (word ceiling), and (for Google reviews) the Enricher Apify
          scrape.
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
                  {formatLimit(limit.unit, limit.min, max)}
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
          Canonical slugs in <code className="text-xs">place_categories</code>. Enricher
          inference picks from this list.
        </p>
        <Collapsible summary={`Show ${data.counts.categories} categories`}>
          <div className="flex flex-col gap-6">
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
        </Collapsible>
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
        <Collapsible
          summary={`Show ${data.counts.tags} tags · up to ${data.fieldLimits.tagsPerPlace?.max ?? 20} per place`}
        >
          <div className="flex flex-col gap-6">
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
        </Collapsible>
      </section>
    </div>
  );
}

/** Turn the four writer/editor flags into one plain sentence pair. */
function describePermission(row: PlaceFieldPermission): string {
  const writer =
    row.native && row.enricher
      ? "Google seeds it and the Enricher refines it."
      : row.native
        ? "Google writes it."
        : row.enricher
          ? "The Enricher writes it."
          : "No automatic writer.";

  const editor =
    row.admin && row.business
      ? "Admin and business can edit it."
      : row.admin
        ? "Admin can edit it, business cannot."
        : row.business
          ? "Business can edit it, admin cannot."
          : "Read-only in both Place UIs.";

  return `${writer} ${editor}`;
}

function humanizeKey(key: string): string {
  if (key === "tagsPerPlace") return "Tags per place";
  if (key === "tagCatalogSize") return "Tag catalog";
  if (key === "photos") return "Photos";
  if (key === "googleReviews") return "Google reviews";
  if (key === "descriptionEnricherMax") return "Description (Enricher synthesis)";
  if (key === "embeddingSourceText") return "Embedding source text (Place Synthesis)";
  if (key === "priceLevel") return "Price level";
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatLimit(
  unit: "chars" | "words" | "count" | "range",
  min: number | undefined,
  max: number,
): string {
  if (unit === "range") return `${min ?? 0}–${max}`;
  if (unit === "count") return `Up to ${max.toLocaleString()}`;
  if (unit === "words") return `${max.toLocaleString()} words`;
  return `${max.toLocaleString()} chars`;
}
