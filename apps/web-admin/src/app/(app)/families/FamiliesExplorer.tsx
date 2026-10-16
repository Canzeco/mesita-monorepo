"use client";

import { useMemo, useState } from "react";
import { setCategoryFamilies } from "./actions";
import type { CategoryRow, FamiliesMap, FamilyRow, TagRow } from "./highlight";

/** The column shows spaces. Search must hit that label and the stored slug. */
export function googleTypeHaystack(slug: string): string {
  return `${slug.replaceAll("_", " ")} ${slug}`;
}

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

export function FamiliesExplorer({ map }: { map: FamiliesMap }) {
  const [tagQuery, setTagQuery] = useState("");
  const [categories, setCategories] = useState(map.categories);
  const tagGroups = useMemo(() => groupTags(map.tags, tagQuery), [map.tags, tagQuery]);

  return (
    <>
      <p className="text-muted-foreground mt-8 text-sm">
        {categories.length} categories · {map.tags.length} tags · {map.families.length} families
      </p>
      <CategorySection
        categories={categories}
        families={map.families}
        onSaved={(slug, familyKeys) => {
          setCategories((rows) =>
            rows.map((row) => (row.slug === slug ? { ...row, familyKeys } : row)),
          );
        }}
      />
      <TagsList
        groups={tagGroups}
        count={map.tags.length}
        query={tagQuery}
        onQuery={setTagQuery}
      />
      <FamiliesSection families={map.families} categories={categories} />
    </>
  );
}

function CategorySection({
  categories,
  families,
  onSaved,
}: {
  categories: CategoryRow[];
  families: FamilyRow[];
  onSaved: (slug: string, familyKeys: string[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function toggle(category: CategoryRow, family: string, on: boolean) {
    const next = on
      ? [...category.familyKeys, family]
      : category.familyKeys.filter((key) => key !== family);
    setPending(category.slug);
    setError(null);
    const saved = await setCategoryFamilies(category.slug, next);
    setPending(null);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    onSaved(category.slug, saved.familyKeys);
  }

  return (
    <section className="border-border bg-card mt-4 rounded-2xl border">
      <div className="border-border border-b p-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Categories
          <span className="text-muted-foreground ml-2 font-normal">{categories.length}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          One category maps to the families checked here. Places are not listed.
        </p>
        {error ? <p className="text-destructive mt-2 text-sm">{error}</p> : null}
      </div>
      <ul className="max-h-[32rem] divide-y overflow-y-auto">
        {categories.map((category) => (
          <li key={category.slug} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium">{category.label}</span>
            <span className="flex flex-wrap gap-3">
              {families.map((family) => (
                <label key={family.slug} className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={category.familyKeys.includes(family.slug)}
                    disabled={pending === category.slug}
                    onChange={(e) => void toggle(category, family.slug, e.target.checked)}
                  />
                  {family.label}
                </label>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FamiliesSection({
  families,
  categories,
}: {
  families: FamilyRow[];
  categories: CategoryRow[];
}) {
  return (
    <section className="border-border bg-card mt-4 rounded-2xl border">
      <div className="border-border border-b p-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Families
          <span className="text-muted-foreground ml-2 font-normal">{families.length}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Each family lists the categories it contains. The mapping is the dictionary, not a place field.
        </p>
      </div>
      <ul className="divide-y">
        {families.map((family) => {
          const members = categories.filter((row) => row.familyKeys.includes(family.slug));
          return (
            <li key={family.slug} className="p-4">
              <h3 className="text-sm font-medium">
                {family.emoji ? `${family.emoji} ` : ""}
                {family.label}
                <span className="text-muted-foreground ml-2 font-normal">{members.length}</span>
              </h3>
              {members.length === 0 ? (
                <p className="text-muted-foreground mt-1 text-sm">No categories.</p>
              ) : (
                <p className="text-muted-foreground mt-1 text-sm">
                  {members.map((row) => row.label).join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
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
          Tags
          <span className="text-muted-foreground ml-2 font-normal">{count}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The full catalog. Nothing here is selected or saved.
        </p>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search Tags"
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
