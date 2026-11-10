"use client";

import { businessPlaceHref } from "@/lib/business-url";
import { PlaceDoor } from "@/components/PlaceDoor";
import { Fragment } from "react";
import {
  BAD_WHEN_TRUE,
  GENERAL_STATE_FACTS,
  premierTierChip,
  REVIEW_STATE_FACTS,
  STATE_FACT_FALSE_TONE,
} from "@/lib/state-vocabulary";
import { STICKY_COL_CELL, STICKY_COL_HEAD } from "@/lib/ui-classes";
import { factOn, type Row } from "./mesita-search-facts";
import { StatePill } from "./PlaceFacts";
import { PlaceStateCells, PlaceStateHeads, PlaceStatePill } from "./PlaceStateCells";

// Every state of Main §10 (MESITA-3595): the Profile States (Premier, a
// tier, after Enriched, as on the card), then the twelve Place States, then
// the three Reviews states.
const HEAD = "px-3 py-3 text-center font-semibold whitespace-nowrap";
const CELL = "px-3 py-3 text-center";
const EDGE = "border-border/60 border-l";

export function MesitaSearchResults({ rows }: { rows: Row[] }) {
  return (
    // Bleeds through the card's padding on a phone so the scrollport is
    // the full screen rather than the ~295px left inside it.
    <div className="border-border bg-card -mx-5 mt-6 overflow-hidden border-y sm:mx-0 sm:rounded-2xl sm:border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[2600px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-muted-foreground bg-muted/30 text-left type-label font-semibold tracking-[0.12em] uppercase">
              <th className={`px-4 py-3 font-semibold ${STICKY_COL_HEAD}`}>
                Place
              </th>
              {GENERAL_STATE_FACTS.map((f) => (
                <Fragment key={f.key}>
                  <th className={HEAD}>{f.label}</th>
                  {f.key === "enriched" ? <th className={HEAD}>Premier</th> : null}
                </Fragment>
              ))}
              <PlaceStateHeads className={HEAD} edgeClassName={EDGE} />
              {REVIEW_STATE_FACTS.map((f, i) => (
                <th key={f.key} className={`${HEAD} ${i === 0 ? EDGE : ""}`}>
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
                      <>
                        {/* The name is the door to the place page, in the
                            Business app since MESITA-3104. */}
                        <PlaceDoor
                          href={businessPlaceHref(hit.id, "admin")}
                          className="block truncate font-medium underline-offset-4 hover:underline"
                        >
                          {hit.name || hit.google_name}
                        </PlaceDoor>
                      </>
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
                  {GENERAL_STATE_FACTS.map((f) => (
                    <Fragment key={f.key}>
                      <td className={hit ? CELL : `text-muted-foreground ${CELL}`}>
                        {hit ? (
                          <StatePill
                            on={factOn(hit, f.key)}
                            falseTone={STATE_FACT_FALSE_TONE[f.key]}
                            badWhenTrue={BAD_WHEN_TRUE.has(f.key)}
                          />
                        ) : (
                          "—"
                        )}
                      </td>
                      {/* Premier, so a Multiple Places › Edit run can be
                          checked by searching again (MESITA-3090). */}
                      {f.key === "enriched" ? (
                        <td className={hit ? CELL : `text-muted-foreground ${CELL}`}>
                          {hit ? (
                            <PlaceStatePill
                              on={(hit.boost_tier ?? 0) > 0}
                              chip={premierTierChip(hit.boost_tier)}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                      ) : null}
                    </Fragment>
                  ))}
                  <PlaceStateCells
                    hit={hit}
                    className={hit ? CELL : `text-muted-foreground ${CELL}`}
                    edgeClassName={EDGE}
                    empty={() => "—"}
                  />
                  {REVIEW_STATE_FACTS.map((f, i) => (
                    <td
                      key={f.key}
                      className={`${hit ? CELL : `text-muted-foreground ${CELL}`} ${i === 0 ? EDGE : ""}`}
                    >
                      {hit ? <StatePill on={hit[f.key] === true} /> : "—"}
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
