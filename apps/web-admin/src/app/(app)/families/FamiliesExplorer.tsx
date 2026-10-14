"use client";

import { useMemo, useState } from "react";
import {
  highlightFamilies,
  type FamiliesMap,
  type FamiliesSelection,
} from "./highlight";

const OTHER = { slug: "other", label: "Other", emoji: "" };

function matches(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

/** The column shows spaces. Search must hit that label and the stored slug. */
export function googleTypeHaystack(slug: string): string {
  return `${slug.replaceAll("_", " ")} ${slug}`;
}

export function FamiliesExplorer({ map }: { map: FamiliesMap }) {
  const [sel, setSel] = useState<FamiliesSelection>({
    kind: "family",
    slug: map.families[0]?.slug ?? "restaurants",
  });
  const [googleQuery, setGoogleQuery] = useState("");
  const [familyQuery, setFamilyQuery] = useState("");
  const [categoryQuery, setCategoryQuery] = useState("");
  const hit = useMemo(() => highlightFamilies(map, sel), [map, sel]);

  const families = [
    ...map.families,
    OTHER,
  ];

  return (
    <div className="mt-8 grid gap-4 lg:grid-cols-3">
      <Column
        title="Google Place Categories"
        query={googleQuery}
        onQuery={setGoogleQuery}
        count={map.googleTypes.length}
      >
        {map.googleTypes
          .filter((row) => matches(googleQuery, googleTypeHaystack(row.slug)) || hit.google.has(row.slug))
          .map((row) => (
            <Row
              key={row.slug}
              label={row.slug.replaceAll("_", " ")}
              selected={sel.kind === "google" && sel.slug === row.slug}
              related={hit.google.has(row.slug)}
              onClick={() => setSel({ kind: "google", slug: row.slug })}
            />
          ))}
      </Column>
      <Column
        title="Mesita Families"
        query={familyQuery}
        onQuery={setFamilyQuery}
        count={families.length}
      >
        {families
          .filter((row) => matches(familyQuery, `${row.label} ${row.slug}`) || hit.families.has(row.slug))
          .map((row) => (
            <Row
              key={row.slug}
              label={row.emoji ? `${row.emoji} ${row.label}` : row.label}
              selected={sel.kind === "family" && sel.slug === row.slug}
              related={hit.families.has(row.slug)}
              onClick={() => setSel({ kind: "family", slug: row.slug })}
            />
          ))}
      </Column>
      <Column
        title="Mesita Categories"
        query={categoryQuery}
        onQuery={setCategoryQuery}
        count={map.categories.length}
      >
        {map.categories
          .filter((row) => matches(categoryQuery, `${row.label} ${row.slug}`) || hit.categories.has(row.slug))
          .map((row) => (
            <Row
              key={row.slug}
              label={row.label}
              selected={sel.kind === "category" && sel.slug === row.slug}
              related={hit.categories.has(row.slug)}
              onClick={() => setSel({ kind: "category", slug: row.slug })}
            />
          ))}
      </Column>
    </div>
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
