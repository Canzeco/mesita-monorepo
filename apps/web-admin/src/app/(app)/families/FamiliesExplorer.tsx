"use client";

import { useMemo, useState } from "react";
import { Chip, SearchField, SectionCard } from "@/components/admin-ui";
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

// Atlas (MESITA-2891): the thirty Mesita Families, the Google categories
// side by side — allowed, and not allowed (MESITA-4680: Google's list from
// code; the database stores only the allowed, MESITA-4576) — then the tag
// catalog. There
// is no category ↔ family matrix: a place's families are the Description
// step's model pick.
export function FamiliesExplorer({ map }: { map: FamiliesMap }) {
  const [categoryQuery, setCategoryQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const tagGroups = useMemo(() => groupTags(map.tags, tagQuery), [map.tags, tagQuery]);

  return (
    <div className="flex flex-col gap-4">
      <FamiliesList families={map.families} />
      <SectionCard
        title="Google categories"
        right={<Count n={map.enabledCategories.length + map.notAllowedCategories.length} />}
        subtitle={
          <>
            Which Google categories Mesita allows, and which it does not. A
            place whose main Google category is not allowed cannot be added.
          </>
        }
      >
        <SearchField
          value={categoryQuery}
          onChange={setCategoryQuery}
          placeholder="Search"
          aria-label="Search Google categories"
          className="mt-4"
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <CategoryList
            title="Allowed on Mesita"
            rows={map.enabledCategories}
            query={categoryQuery}
          />
          <CategoryList
            title="Not allowed"
            rows={map.notAllowedCategories}
            query={categoryQuery}
          />
        </div>
      </SectionCard>
      <TagsList
        groups={tagGroups}
        count={map.tags.length}
        query={tagQuery}
        onQuery={setTagQuery}
      />
    </div>
  );
}

/** A section's row count, muted, in the card's right slot. */
function Count({ n }: { n: number }) {
  return <span className="text-muted-foreground text-sm tabular-nums">{n}</span>;
}

function FamiliesList({ families }: { families: FamilyRow[] }) {
  return (
    <SectionCard
      title="Mesita Families"
      right={<Count n={families.length} />}
      subtitle="What the Description step picks from, carefully: about four on Create, about six after Enrich, never more than seven. Each family's meaning is what the model reads."
    >
      <ul className="mt-4 divide-y divide-border">
        {families.map((family) => (
          <li key={family.slug} className="flex items-baseline gap-3 py-2">
            <Chip title={family.slug}>
              {family.emoji ? `${family.emoji} ` : ""}
              {family.label}
            </Chip>
            {family.meaning ? (
              <span className="text-muted-foreground text-sm">{family.meaning}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </SectionCard>
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
    <SectionCard
      title="Mesita Tags"
      right={<Count n={count} />}
      subtitle="The full catalog. Nothing here is selected or saved."
    >
      <SearchField
        value={query}
        onChange={onQuery}
        placeholder="Search"
        aria-label="Search Mesita Tags"
        className="mt-4"
      />
      <div className="mt-4 max-h-[32rem] space-y-4 overflow-y-auto">
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
                  <li key={row.slug}>
                    <Chip>{row.label}</Chip>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}
