"use client";

import { useMemo, useState } from "react";
import type { FamiliesMap, FamilyRow, GoogleCategoryRow, TagRow } from "./highlight";

export type TagGroup = {
  key: string;
  title: string;
  rows: { slug: string; label: string }[];
};

/** Tags arrive in facet order. A search keeps that order and drops empty facets. */
export function groupTags(tags: TagRow[], query: string): TagGroup[] {
  const q = query.trim().toLowerCase();
  const groups: TagGroup[] = [];
  for (const tag of tags) {
    if (q && !`${tag.label} ${tag.slug}`.toLowerCase().includes(q)) continue;
    const title = tag.facetEmoji ? `${tag.facetEmoji} ${tag.facetLabel}` : tag.facetLabel;
    const row = { slug: tag.slug, label: tag.label };
    const last = groups[groups.length - 1];
    if (last?.key === tag.facet) last.rows.push(row);
    else groups.push({ key: tag.facet, title, rows: [row] });
  }
  return groups;
}

/** A Google category matches on its readable label and its stored slug. */
export function matchesCategory(row: GoogleCategoryRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  return !q || `${row.label} ${row.slug} ${row.slug.replaceAll("_", " ")}`.toLowerCase().includes(q);
}

// Atlas (MESITA-2891): the thirty-seven Mesita Families, every Google category
// split into enabled and not enabled on Mesita, then the tag catalog. There
// is no category ↔ family matrix: a place's families are the Description
// step's model pick.
export function FamiliesExplorer({ map }: { map: FamiliesMap }) {
  const [categoryQuery, setCategoryQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const tagGroups = useMemo(() => groupTags(map.tags, tagQuery), [map.tags, tagQuery]);

  return (
    <>
      <FamiliesList families={map.families} />
      <section className="border-border bg-card mt-4 rounded-2xl border">
        <div className="border-border border-b p-4">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            Google categories
            <span className="text-muted-foreground ml-2 font-normal">
              {map.enabledCategories.length + map.disabledCategories.length}
            </span>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Google&apos;s canonical list. A place whose main Google category is not
            enabled gets no Mesita Families, so it never shows to a guest.
          </p>
          <input
            value={categoryQuery}
            onChange={(e) => setCategoryQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search Google categories"
            className="border-border bg-background focus:border-foreground mt-3 h-9 w-full rounded-lg border px-3 text-sm outline-none"
          />
        </div>
        <div className="grid gap-4 p-4 lg:grid-cols-2">
          <CategoryList
            title="Enabled on Mesita"
            rows={map.enabledCategories}
            query={categoryQuery}
          />
          <CategoryList
            title="Not enabled on Mesita"
            rows={map.disabledCategories}
            query={categoryQuery}
          />
        </div>
      </section>
      <TagsList
        groups={tagGroups}
        count={map.tags.length}
        query={tagQuery}
        onQuery={setTagQuery}
      />
    </>
  );
}

function FamiliesList({ families }: { families: FamilyRow[] }) {
  return (
    <section className="border-border bg-card mt-8 rounded-2xl border">
      <div className="border-border border-b p-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Mesita Families
          <span className="text-muted-foreground ml-2 font-normal">{families.length}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The list the Description step picks from: one to five per place, inferred on
          Create and every Enrich.
        </p>
      </div>
      <ul className="flex flex-wrap gap-2 p-4">
        {families.map((family) => (
          <li
            key={family.slug}
            className="border-border bg-background rounded-full border px-3 py-1 text-sm"
            title={family.slug}
          >
            {family.emoji ? `${family.emoji} ` : ""}
            {family.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategoryList({
  title,
  rows,
  query,
}: {
  title: string;
  rows: GoogleCategoryRow[];
  query: string;
}) {
  const visible = rows.filter((row) => matchesCategory(row, query));
  return (
    <div className="border-border min-w-0 rounded-xl border">
      <h3 className="border-border border-b px-3 py-2 text-sm font-medium">
        {title}
        <span className="text-muted-foreground ml-2 font-normal">{rows.length}</span>
      </h3>
      {visible.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-sm">No matching categories.</p>
      ) : (
        <ul className="max-h-[32rem] overflow-y-auto">
          {visible.map((row, index) => (
            <li
              key={row.slug}
              title={row.slug}
              className={`truncate px-3 py-1.5 text-sm ${index % 2 === 1 ? "bg-muted/30" : ""}`}
            >
              {row.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TagsList({
  groups,
  count,
  query,
  onQuery,
}: {
  groups: TagGroup[];
  count: number;
  query: string;
  onQuery: (value: string) => void;
}) {
  return (
    <section className="border-border bg-card mt-4 rounded-2xl border">
      <div className="border-border border-b p-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Mesita Tags
          <span className="text-muted-foreground ml-2 font-normal">{count}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The full catalog. Nothing here is selected or saved.
        </p>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search Mesita Tags"
          className="border-border bg-background focus:border-foreground mt-3 h-9 w-full rounded-lg border px-3 text-sm outline-none"
        />
      </div>
      <div className="max-h-[32rem] space-y-4 overflow-y-auto p-4">
        {groups.length === 0 ? (
          <p className="text-muted-foreground text-sm">No matching tags.</p>
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <h3 className="text-muted-foreground type-eyebrow">
                {group.title}
              </h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {group.rows.map((row) => (
                  <li
                    key={row.slug}
                    className="border-border bg-background rounded-full border px-3 py-1 text-sm"
                  >
                    {row.label}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
