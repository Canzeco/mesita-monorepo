"use client";

import { useMemo, useState } from "react";
import { CATALOG_FAMILY_FACTS } from "../filters-config/discovery-surface";
import {
  cellOn,
  filterMembershipRows,
  googleCategoryLabel,
  guestFamilyColumns,
  type MembershipFamily,
  type MembershipRow,
} from "./membership-matrix";

const FAMILY_EMOJI = new Map(
  CATALOG_FAMILY_FACTS.map((family) => [family.key, family.emoji]),
);

function familyMark(family: MembershipFamily): string {
  if (family.emoji && family.emoji !== "·") return family.emoji;
  return FAMILY_EMOJI.get(family.slug) ?? "";
}

export function MembershipMatrix({
  families,
  rows,
}: {
  families: MembershipFamily[];
  rows: MembershipRow[];
}) {
  const [query, setQuery] = useState("");
  const columns = useMemo(() => guestFamilyColumns(families), [families]);
  const visible = useMemo(() => filterMembershipRows(rows, query), [rows, query]);
  const inAFamily = rows.filter((row) => row.familyKeys.length > 0).length;

  return (
    <section className="border-border bg-card mt-8 overflow-hidden rounded-2xl border">
      <div className="border-border border-b p-4">
        <h2 className="font-display text-sm font-semibold tracking-tight">
          Google categories
          <span className="text-muted-foreground ml-2 font-normal">{rows.length}</span>
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {columns.length} guest families · {inAFamily} categories in a family ·{" "}
          {rows.length - inAFamily} in none. A mark means that Google category sits in
          that family. One place has one category. A category can sit in several families.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search Google categories"
          className="border-border bg-background focus:border-foreground mt-3 h-9 w-full rounded-lg border px-3 text-sm outline-none"
        />
      </div>
      <div className="max-h-[40rem] overflow-auto">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="bg-card border-border sticky left-0 z-10 border-b px-3 py-2 text-left font-medium">
                Google category
              </th>
              {columns.map((family) => (
                <th
                  key={family.slug}
                  className="border-border bg-card sticky top-0 z-10 border-b px-2 py-2 text-center font-medium"
                >
                  <span className="block text-base leading-none" aria-hidden>
                    {familyMark(family)}
                  </span>
                  <span className="mt-1 block">{family.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="text-muted-foreground px-3 py-4"
                >
                  No matching categories.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <tr key={row.slug}>
                  <th className="bg-card border-border sticky left-0 border-b px-3 py-2 text-left font-normal">
                    <span className="block">{googleCategoryLabel(row.slug)}</span>
                    <span className="text-muted-foreground block font-mono text-xs">
                      {row.slug}
                    </span>
                  </th>
                  {columns.map((family) => {
                    const on = cellOn(row, family.slug);
                    return (
                      <td
                        key={family.slug}
                        className="border-border border-b px-2 py-2 text-center"
                        aria-label={`${row.slug} ${on ? "in" : "not in"} ${family.label}`}
                      >
                        {on ? "●" : ""}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
