"use client";

import Link from "next/link";
import { placeTabHref } from "@/lib/place-tabs";
import {
  BAD_WHEN_TRUE,
  GENERAL_STATE_FACTS,
  REVIEW_STATE_FACTS,
  STATE_FACT_FALSE_TONE,
} from "@/lib/state-vocabulary";
import { STICKY_COL_CELL, STICKY_COL_HEAD } from "@/lib/ui-classes";
import { factOn, type Row } from "./mesita-search-facts";
import { StatePill } from "./PlaceFacts";

export function MesitaSearchResults({ rows }: { rows: Row[] }) {
  return (
    // Bleeds through the card's padding on a phone so the scrollport is
    // the full screen rather than the ~295px left inside it.
    <div className="border-border bg-card -mx-5 mt-6 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1400px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase">
              <th className={`px-4 py-3 font-semibold ${STICKY_COL_HEAD}`}>
                Place
              </th>
              {GENERAL_STATE_FACTS.map((f) => (
                <th key={f.key} className="px-3 py-3 text-center font-semibold">
                  {f.label}
                </th>
              ))}
              {REVIEW_STATE_FACTS.map((f) => (
                <th key={f.key} className="px-3 py-3 text-center font-semibold">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              // Bind the hit to a const first: narrowing `row.hit` would
              // not survive into the per-fact closures below.
              const hit = row.hit;
              return (
                <tr
                  key={row.key}
                  className="[&>td]:border-border/60 [&>td]:border-t"
                >
                  <td
                    className={`max-w-[60vw] px-4 py-3 sm:max-w-[280px] ${STICKY_COL_CELL}`}
                  >
                    {hit ? (
                      // The name is the door to Single Place (MESITA-2086):
                      // the place surface, not a second facts card.
                      <Link
                        href={placeTabHref(hit.id, "profile")}
                        className="block truncate font-medium underline-offset-4 hover:underline"
                      >
                        {hit.google_name || hit.name}
                      </Link>
                    ) : (
                      <>
                        <p className="text-muted-foreground font-mono text-xs">
                          {row.googleId}
                        </p>
                        <p className="text-muted-foreground type-label">
                          Not on Mesita
                        </p>
                      </>
                    )}
                  </td>
                  {hit
                    ? GENERAL_STATE_FACTS.map((f) => (
                        <td key={f.key} className="px-3 py-3 text-center">
                          {f.key === "requested" ? (
                            <span
                              className={
                                "type-label font-semibold tabular-nums " +
                                (hit.request_count > 0
                                  ? "text-foreground"
                                  : "text-muted-foreground")
                              }
                            >
                              {hit.request_count}
                            </span>
                          ) : (
                            <StatePill
                              on={factOn(hit, f.key)}
                              falseTone={STATE_FACT_FALSE_TONE[f.key]}
                              badWhenTrue={BAD_WHEN_TRUE.has(f.key)}
                            />
                          )}
                        </td>
                      ))
                    : GENERAL_STATE_FACTS.map((f) => (
                        <td
                          key={f.key}
                          className="text-muted-foreground px-3 py-3 text-center"
                        >
                          —
                        </td>
                      ))}
                  {hit
                    ? REVIEW_STATE_FACTS.map((f) => (
                        <td key={f.key} className="px-3 py-3 text-center">
                          <StatePill on={hit[f.key] === true} />
                        </td>
                      ))
                    : REVIEW_STATE_FACTS.map((f) => (
                        <td
                          key={f.key}
                          className="text-muted-foreground px-3 py-3 text-center"
                        >
                          —
                        </td>
                      ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
