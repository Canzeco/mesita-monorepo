"use client";

import { useMemo, useState } from "react";
import {
  type FamiliesMap,
  type FamiliesSelection,
  type TagRow,
} from "./highlight";

function matches(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

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
  const [sel, setSel] = useState<FamiliesSelection>({
    kind: "category",
    slug: map.categories[0]?.slug ?? "",
  });
  const [categoryQuery, setCategoryQuery] = useState("");
  const [tagQuery, setTagQuery] = useState("");
  const tagGroups = useMemo(() => groupTags(map.tags, tagQuery), [map.tags, tagQuery]);

  return (
    <>
      <div className="mt-8 grid gap-4 lg:grid-cols-1">
        <Column
          title="Categories"
          query={categoryQuery}
          onQuery={setCategoryQuery}
          count={map.categories.length}
        >
          {map.categories
            .filter((row) => matches(categoryQuery, `${row.emoji ?? ""} ${row.label} ${row.slug}`))
            .map((row) => (
              <Row
                key={row.slug}
                label={row.emoji ? `${row.emoji} ${row.label}` : row.label}
                selected={sel.kind === "category" && sel.slug === row.slug}
                related={false}
                onClick={() => setSel({ kind: "category", slug: row.slug })}
              />
            ))}
        </Column>
      </div>
      <TagsList
        groups={tagGroups}
        count={map.tags.length}
        query={tagQuery}
        onQuery={setTagQuery}
      />
    </>
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

function Column({
  title,
  query,
  onQuery,
  count,
  children,
}: {
  title: string;
  query: string;
  onQuery: (value: string) => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section className="border-border bg-card flex min-h-0 flex-col rounded-2xl border">
      <div className="border-border border-b p-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          {title}
          <span className="text-muted-foreground ml-2 font-normal">{count}</span>
        </h2>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search"
          aria-label={`Search ${title}`}
          className="border-border bg-background focus:border-foreground mt-3 h-9 w-full rounded-lg border px-3 text-sm outline-none"
        />
      </div>
      <ul className="max-h-[32rem] overflow-y-auto p-2">{children}</ul>
    </section>
  );
}

function Row({
  label,
  selected,
  related,
  onClick,
}: {
  label: string;
  selected: boolean;
  related: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={
          "w-full rounded-lg px-3 py-2 text-left text-sm " +
          (selected
            ? "bg-foreground text-background"
            : related
              ? "bg-secondary text-secondary-foreground"
              : "hover:bg-muted")
        }
      >
        {label}
      </button>
    </li>
  );
}
