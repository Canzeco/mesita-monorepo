"use client";

import { useMemo } from "react";
import { Collapsible } from "../enricher-config/atlas-ui";
import type { AtlasFieldsPayload } from "./actions";
import {
  PLACE_FIELD_PERMISSIONS,
  PLACE_FIELD_PERMISSION_GROUPS,
  PLACE_FIELD_EDIT_ROLES,
  PLACE_FIELD_EDIT_ROLE_LABELS,
  type PlaceFieldPermission,
} from "./place-field-permissions";

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

  const permissionsByGroup = useMemo(() => {
    const map = new Map<PlaceFieldPermission["group"], PlaceFieldPermission[]>();
    for (const row of PLACE_FIELD_PERMISSIONS) {
      const list = map.get(row.group) ?? [];
      list.push(row);
      map.set(row.group, list);
    }
    return map;
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold tracking-tight">
          Who can edit
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Place profile fields — who may write each one today. Read-only matrix
          from shipped native / enricher / admin / business contracts (not a
          live ACL toggle).
        </p>
        <div className="mt-5 -mx-4 overflow-x-auto sm:mx-0">
          <table className="w-full min-w-[600px] border-separate border-spacing-0 px-4 sm:px-0">
            <thead>
              <tr className="text-muted-foreground text-left text-xs">
                <th className="border-border border-b pb-2 pl-1 font-medium">
                  Field
                </th>
                {PLACE_FIELD_EDIT_ROLES.map((role, i) => (
                  <th
                    key={role}
                    className={
                      i === PLACE_FIELD_EDIT_ROLES.length - 1
                        ? "border-border border-b pb-2 pr-1 text-center font-medium"
                        : "border-border border-b pb-2 text-center font-medium"
                    }
                  >
                    {PLACE_FIELD_EDIT_ROLE_LABELS[role]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLACE_FIELD_PERMISSION_GROUPS.map((group) => {
                const rows = permissionsByGroup.get(group) ?? [];
                if (rows.length === 0) return null;
                return (
                  <PermissionGroupRows key={group} group={group} rows={rows} />
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border-border bg-card rounded-2xl border p-4 sm:p-6">
        <h2 className="font-display text-base font-semibold tracking-tight">Field limits</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Profile-spec caps from the Enricher shared limits — enforced in the
          business Place editor / business-update-project, and (for Google
          reviews) the Enricher Apify scrape.
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

function PermissionGroupRows({
  group,
  rows,
}: {
  group: PlaceFieldPermission["group"];
  rows: PlaceFieldPermission[];
}) {
  return (
    <>
      <tr>
        <td
          colSpan={1 + PLACE_FIELD_EDIT_ROLES.length}
          className="text-muted-foreground pt-4 pb-1.5 pl-1 text-[10px] font-semibold tracking-wide uppercase"
        >
          {group}
        </td>
      </tr>
      {rows.map((row) => (
        <tr key={row.key} className="align-top">
          <td className="border-border/60 border-b py-2.5 pl-1">
            <div className="text-sm font-medium">{row.label}</div>
            {row.note ? (
              <div className="text-muted-foreground mt-0.5 max-w-md text-xs leading-snug">
                {row.note}
              </div>
            ) : null}
          </td>
          {PLACE_FIELD_EDIT_ROLES.map((role, i) => (
            <td
              key={role}
              className={
                i === PLACE_FIELD_EDIT_ROLES.length - 1
                  ? "border-border/60 border-b py-2.5 pr-1 text-center"
                  : "border-border/60 border-b py-2.5 text-center"
              }
            >
              <PermissionCell allowed={row[role]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function PermissionCell({ allowed }: { allowed: boolean }) {
  return (
    <span
      className={
        allowed
          ? "bg-emerald-500/10 text-emerald-700 inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-semibold"
          : "bg-muted text-muted-foreground inline-flex min-w-[2.25rem] items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium"
      }
      title={allowed ? "Can edit" : "Cannot edit"}
    >
      {allowed ? "Yes" : "No"}
    </span>
  );
}

function humanizeKey(key: string): string {
  if (key === "tagsPerPlace") return "Tags per place";
  if (key === "tagCatalogSize") return "Tag catalog";
  if (key === "photos") return "Photos";
  if (key === "googleReviews") return "Google reviews";
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
    "googleReviews",
  ]);
  if (key === "tagsPerPlace") return `Up to ${max.toLocaleString()}`;
  if (key === "photos" || key === "googleReviews") {
    return `Up to ${max.toLocaleString()}`;
  }
  if (countKeys.has(key)) return max.toLocaleString();
  return `${max.toLocaleString()} chars`;
}
