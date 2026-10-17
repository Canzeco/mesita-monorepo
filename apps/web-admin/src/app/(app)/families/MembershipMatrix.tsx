"use client";

import { useMemo, useState } from "react";
import {
  cellOn,
  filterMembershipRows,
  googleCategoryLabel,
  guestFamilyColumns,
  type MembershipFamily,
  type MembershipRow,
} from "./membership-matrix";

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
          {columns.length} guest families · {inAFamily} in a family ·{" "}
          {rows.length - inAFamily} in none. A filled square means that category sits
          in that family.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search Google categories"
          className="border-border bg-background focus:border-foreground mt-3 h-9 w-full rounded-lg border px-3 text-sm outline-none"
        />
      </div>
      <div className="max-h-[calc(100vh-16rem)] overflow-auto">
        <table className="w-full table-fixed border-separate border-spacing-0 text-sm">
          <colgroup>
            <col className="w-56" />
            {columns.map((family) => (
              <col key={family.slug} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="border-border bg-card sticky top-0 left-0 z-30 border-r border-b px-3 text-left align-bottom text-xs font-medium">
                <span className="block pb-2">Google category</span>
              </th>
              {columns.map((family) => (
                <th
                  key={family.slug}
                  className="border-border bg-muted/40 sticky top-0 z-20 border-b border-l p-0 align-bottom"
                >
                  <span className="flex h-36 items-end justify-center pb-2">
                    <span className="type-label leading-none font-medium whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
                      {family.label}
                    </span>
                  </span>
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
              visible.map((row, index) => {
                const stripe = index % 2 === 1;
                const paint = stripe
                  ? "bg-muted/30 group-hover:bg-muted"
                  : "bg-card group-hover:bg-muted";
                return (
                  <tr key={row.slug} className="group">
                    <th
                      className={`border-border sticky left-0 z-10 border-r border-b px-3 py-1.5 text-left font-normal ${paint}`}
                      title={row.slug}
                    >
                      <span className="block truncate">{googleCategoryLabel(row.slug)}</span>
                    </th>
                    {columns.map((family) => {
                      const on = cellOn(row, family.slug);
                      return (
                        <td
                          key={family.slug}
                          className={`border-border border-b border-l p-0 text-center align-middle ${paint}`}
                          aria-label={`${row.slug} ${on ? "in" : "not in"} ${family.label}`}
                        >
                          {on ? (
                            <span
                              aria-hidden
                              className="bg-foreground mx-auto block size-2.5 rounded-[2px]"
                            />
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
