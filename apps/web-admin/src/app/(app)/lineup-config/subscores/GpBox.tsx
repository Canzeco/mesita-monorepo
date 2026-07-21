"use client";

import { PIPELINE_CONTEXT, gpParts } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { ContextCols, MiniTile, Slider } from "../panel-ui";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// GP · Google Popularity — earned merit (amber).

export function GpBox() {
  const { gp, setGp } = useScoring();

  // Worked examples — live at the current ceiling; the regression strip for
  // knob edits (drag the knob, watch the archetypes move).
  const archetypes = [
    { label: "the institution", reviews: 3000, stars: 4.5 },
    { label: "the solid local", reviews: 150, stars: 4.2 },
    { label: "the newcomer", reviews: 5, stars: 5.0 },
    { label: "no google presence", reviews: 0, stars: null as number | null },
  ].map((a) => ({ ...a, parts: gpParts(a.reviews, a.stars, gp) }));

  return (
    <SubscoreBox
      id="gp"
      save="gp"
      tint="amber"
      title="GP Subscore · Google Popularity"
      overview={
        <Prose>
          EARNED popularity — the place&apos;s total Google star mass, log-squashed. The
          organic lanes&apos; merit.
        </Prose>
      }
      hyperparams={
        <KnobGrid>
          <Slider
            label="ln ceiling"
            value={gp.lnCeiling.toFixed(1)}
            min={5}
            max={15}
            step={0.5}
            v={gp.lnCeiling}
            onChange={(v) => setGp({ lnCeiling: v })}
            hint={`GP hits 1 at e^${gp.lnCeiling.toFixed(1)} ≈ ${Math.round(Math.exp(gp.lnCeiling)).toLocaleString("en-US")} star mass`}
          />
        </KnobGrid>
      }
      inputs={<ContextCols ctx={PIPELINE_CONTEXT.gp} />}
      process={
        <>
          <ProcessSteps>
            <p>raw star mass = rating × review count</p>
            <p>
              GP = min(1, ln(1 + raw) / {gp.lnCeiling.toFixed(1)}) — a simple log, NOT a
              sigmoid: no &quot;typical popularity&quot; assumption, one ceiling knob
            </p>
          </ProcessSteps>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {archetypes.map((a) => (
              <MiniTile
                key={a.label}
                label={a.label}
                value={
                  a.stars != null
                    ? `${a.stars.toFixed(1)}★ × ${a.reviews.toLocaleString("en-US")}`
                    : "—"
                }
              >
                <p className="text-muted-foreground mt-0.5 font-mono text-[10px] leading-snug">
                  raw {a.parts.raw.toLocaleString("en-US", { maximumFractionDigits: 0 })} →{" "}
                  <b className="text-foreground">GP {a.parts.gp.toFixed(2)}</b>
                </p>
              </MiniTile>
            ))}
          </div>
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">GP ∈ [0,1]</b> — multiplies Organic + Hybrid; no
          Google presence → 0 and the place exits the organic lanes (a member still rides
          Inorganic).
        </Prose>
      }
    />
  );
}
