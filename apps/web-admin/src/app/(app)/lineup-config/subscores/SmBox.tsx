"use client";

import {
  MISMATCH_RUNG,
  PIPELINE_CONTEXT,
  fitScore,
  waitScore,
  whereScore,
  type SmParams,
} from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { ContextCols, Slider, SubHead } from "../panel-ui";
import { CurvePlot, LadderPlot } from "../plots";
import { ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// SM · Structured Match — where × when × what (emerald).

export function SmBox() {
  const { sm, setSm } = useScoring();

  const setWhere = <K extends keyof SmParams["where"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, where: { ...s.where, [k]: v } }));
  const setWhen = <K extends keyof SmParams["when"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, when: { ...s.when, [k]: v } }));
  const setWhat = <K extends keyof SmParams["what"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, what: { ...s.what, [k]: v } }));

  return (
    <SubscoreBox
      id="sm"
      save="sm"
      tint="emerald"
      title="SM Subscore · Structured Match — where × when × what"
      overview={
        <Prose>
          The intent&apos;s STRUCTURED asks — Where · When · What — checked against place facts:
          where/when are continuous curves, what is the categorical ladder.
        </Prose>
      }
      hyperparams={
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-3">
          <div>
            <SubHead>where · a green default + one hyperparameter</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                consumer
                label="Default tolerance"
                value={`${sm.where.defaultTolKm.toFixed(1)} km`}
                min={0.5}
                max={20}
                step={0.5}
                v={sm.where.defaultTolKm}
                onChange={(v) => setWhere("defaultTolKm", v)}
                hint="the consumer's own Where slider overrides this per query"
              />
              <Slider
                label="Distance falloff"
                value={sm.where.distExp.toFixed(1)}
                min={1}
                max={5}
                step={0.5}
                v={sm.where.distExp}
                onChange={(v) => setWhere("distExp", v)}
                hint={`at ${sm.where.defaultTolKm.toFixed(1)} km tolerance, 8 km → ${whereScore(8, sm.where.defaultTolKm, sm.where.distExp).toFixed(2)}`}
              />
            </div>
          </div>
          <div>
            <SubHead>when · two knobs — closed-now, visit length</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Closed-now floor"
                value={sm.when.waitFloor.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.when.waitFloor}
                onChange={(v) => setWhen("waitFloor", v)}
                hint={`a 2 h wait lands at ${waitScore(2, sm.when).toFixed(2)} — never 0`}
              />
              <Slider
                label="Session length"
                value={`${sm.when.sessionH.toFixed(1)} h`}
                min={0.5}
                max={4}
                step={0.25}
                v={sm.when.sessionH}
                onChange={(v) => setWhen("sessionH", v)}
                hint={`hours the visit needs — 30 min left → fit ${fitScore(0.5, sm.when).toFixed(2)}`}
              />
            </div>
          </div>
          <div>
            <SubHead>what · one knob — the category ladder</SubHead>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <Slider
                label="Super-category rung"
                value={sm.what.sibling.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.what.sibling}
                onChange={(v) => setWhat("sibling", v)}
                hint="same super category, different category — asked cocktail bar, got a mezcalería"
              />
            </div>
          </div>
        </div>
      }
      inputs={<ContextCols ctx={PIPELINE_CONTEXT.sm} />}
      process={
        <>
          <ProcessSteps>
            <p>
              where = 1/(1+(km/tol)^{sm.where.distExp.toFixed(1)}) · tol = the consumer&apos;s
              Where slider (unset → the green default {sm.where.defaultTolKm.toFixed(1)} km) · a
              named zone uses 30% of it · continuous, never a bucket
            </p>
            <p>
              when = wait × fit · wait = {sm.when.waitFloor.toFixed(2)} +{" "}
              {(1 - sm.when.waitFloor).toFixed(2)}/(1+(h/2)^4) · fit = min(1, open/
              {sm.when.sessionH.toFixed(1)}) · times snap to the 30-min grid
            </p>
            <p>
              what ladder: same category → 1 · same super category → {sm.what.sibling.toFixed(2)}{" "}
              · none → {MISMATCH_RUNG.toFixed(2)} (frozen, never 0) · nothing asked → 1
            </p>
          </ProcessSteps>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <CurvePlot
              tone="emerald"
              title="where · distance decay"
              f={(km) => whereScore(km, sm.where.defaultTolKm, sm.where.distExp)}
              x0={0}
              x1={20}
              markers={[{ x: sm.where.defaultTolKm }]}
              xLabel="km → where"
              caption={`tol ${sm.where.defaultTolKm.toFixed(1)} · exp ${sm.where.distExp.toFixed(1)}`}
            />
            <CurvePlot
              tone="emerald"
              title="when · wait (two plateaus)"
              f={(h) => waitScore(h, sm.when)}
              x0={0}
              x1={8}
              markers={[{ x: 2 }]}
              xLabel="h until open → wait"
              caption={`floor ${sm.when.waitFloor.toFixed(2)}`}
            />
            <LadderPlot
              tone="emerald"
              title="what · the ladder"
              bars={[
                { label: "same", value: 1 },
                { label: "super", value: sm.what.sibling },
                { label: "none", value: MISMATCH_RUNG },
              ]}
              caption="category rungs"
            />
          </div>
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">SM = where × when × what ∈ [0,1]</b> — multiplies
          EVERY lane. Structurally infeasible (closed now, cross-town) → the card dies; the
          what ladder alone never vetoes (floor {MISMATCH_RUNG.toFixed(2)}).
        </Prose>
      }
    />
  );
}
