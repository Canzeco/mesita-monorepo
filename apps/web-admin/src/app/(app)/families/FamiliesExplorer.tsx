"use client";

import { useMemo, useState } from "react";
import type { FamiliesMap, FamilyRow, TagRow } from "./highlight";

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
  const guestFamilies = useMemo(
    () => map.families.filter((family) => family.slug !== "undefined"),
    [map.families],
  );
  const tagGroups = useMemo(() => groupTags(map.tags, tagQuery), [map.tags, tagQuery]);

  return (
    <>
      <p className="text-muted-foreground mt-8 text-sm">
        {guestFamilies.length} guest families · {map.tags.length} tags ·{" "}
        {map.googleTypes.length} Google types in the coarse map
      </p>
      <TagsList
        groups={tagGroups}
        count={map.tags.length}
        query={tagQuery}
        onQuery={setTagQuery}
      />
      <FamiliesSection families={guestFamilies} />
    </>
  );
}

function FamiliesSection({ families }: { families: FamilyRow[] }) {
  return (
    <section className="border-border bg-card mt-4 rounded-2xl border">
      <div className="border-border border-b p-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Guest families
          <span className="text-muted-foreground ml-2 font-normal">{families.length}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Loaded live from <code className="text-xs">place_families</code>. Carousel membership
          for a place comes from its Google primary type via the catalog, not from a field on the
          row.
        </p>
      </div>
      <ul className="divide-y">
        {families.map((family) => (
          <li key={family.slug} className="flex items-center gap-2 p-4">
            <span className="text-sm font-medium">
              {family.emoji ? `${family.emoji} ` : ""}
              {family.label}
            </span>
            <span className="text-muted-foreground font-mono text-xs">{family.slug}</span>
          </li>
        ))}
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
