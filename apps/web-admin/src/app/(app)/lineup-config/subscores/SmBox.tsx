"use client";

import {
  DIST_EXP,
  OPENNESS_SLOTS,
  PIPELINE_CONTEXT,
  noneRung,
  synthesizeOpenness,
  whenFromOpenness,
  whereScore,
  type SmParams,
} from "@/lib/business/scores";
import { KnobStatus } from "../../enricher-config/atlas-ui";
import { useScoring } from "../ScoringProvider";
import { ContextCols, Slider, SubHead } from "../panel-ui";
import { CurvePlot, LadderPlot } from "../plots";
import { ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// SM · Structured Match — where × when × what (emerald).
// ONE hyperparam per intent axis (blob v11).

export function SmBox() {
  const { sm, setSm } = useScoring();

  const setWhere = <K extends keyof SmParams["where"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, where: { ...s.where, [k]: v } }));
  const setWhen = <K extends keyof SmParams["when"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, when: { ...s.when, [k]: v } }));
  const setWhat = <K extends keyof SmParams["what"]>(k: K, v: number) =>
    setSm((s) => ({ ...s, what: { ...s.what, [k]: v } }));

  const none = noneRung(sm.what.tol);
  // Live when curve: open-for fixed at 3 h, vary opens-in — shows patience's wait side.
  const whenAt = (opensInH: number) =>
    whenFromOpenness(synthesizeOpenness(opensInH, 3), sm.when.patience);

  return (
    <SubscoreBox
      id="sm"
      save="sm"
      tint="emerald"
      title="SM · Structured Match"
      overview={
        <Prose>
          The intent&apos;s STRUCTURED asks — Where · When · What — one hyperparam each. That
          (the free-text ask) is EM&apos;s, not SM&apos;s.
        </Prose>
      }
      hyperparams={
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-3">
          <div>
            <SubHead>where · distance tolerance</SubHead>
            <div className="mt-2">
              <KnobStatus
                kind="enforced"
                reason="no caller sets LineupContext.tolKm — this is the only tolerance in production, not a default the consumer's Where slider overrides"
              />
            </div>
            <div className="mt-3">
              <Slider
                consumer
                label="Default tolerance"
                value={`${sm.where.defaultTolKm.toFixed(1)} km`}
                min={0.5}
                max={20}
                step={0.5}
                v={sm.where.defaultTolKm}
                onChange={(v) => setWhere("defaultTolKm", v)}
                hint={`applies to every query · falloff frozen at ${DIST_EXP} · 8 km → ${whereScore(8, sm.where.defaultTolKm).toFixed(2)}`}
              />
            </div>
          </div>
          <div>
            <SubHead>when · patience over openness</SubHead>
            <div className="mt-3">
              <Slider
                label="Patience"
                value={sm.when.patience.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.when.patience}
                onChange={(v) => setWhen("patience", v)}
                hint={
                  sm.when.patience < 0.25
                    ? "strict — only open-now-for-a-while"
                    : sm.when.patience > 0.75
                      ? "lenient — future opens + short windows ok"
                      : `mid — a 2 h wait → when ${whenAt(2).toFixed(2)}`
                }
              />
            </div>
          </div>
          <div>
            <SubHead>what · one category tolerance</SubHead>
            <div className="mt-2">
              <KnobStatus
                kind="not-wired"
                reason={'engine hardcodes whatRel:"none" — whatScore is 1 for any t'}
              />
            </div>
            <div className="mt-3">
              <Slider
                label="Tolerance t"
                value={sm.what.tol.toFixed(2)}
                min={0}
                max={1}
                step={0.05}
                v={sm.what.tol}
                onChange={(v) => setWhat("tol", v)}
                hint={`super = t (${sm.what.tol.toFixed(2)}) · none = t² (${none.toFixed(2)}) · exact = 1`}
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
              where = 1/(1+(km/tol)^{DIST_EXP}) · tol = {sm.where.defaultTolKm.toFixed(1)} km ·
              falloff frozen.{" "}
              <span className="text-muted-foreground">
                Spec: the consumer&apos;s Where slider supplies tol and this is only its fallback,
                and a named zone reuses 30% of it. Neither is live — the EFs pass no tolKm and
                always run point mode (zoneMode:false), so every request uses the knob above.
              </span>
            </p>
            <p>
              when = wait × fit over a binary openness array ({OPENNESS_SLOTS} half-hour slots =
              2×24×7 from intent time) · patience {sm.when.patience.toFixed(2)} shapes both
              extremes
            </p>
            <p>
              what ladder (spec): same → 1 · super → {sm.what.tol.toFixed(2)} · none →{" "}
              {none.toFixed(2)} (= t²) · nothing asked → 1.{" "}
              <span className="text-muted-foreground">
                Not live: the EFs carry no category-relation input, so the engine passes
                whatRel:&quot;none&quot; and what = 1 on every card. The ladder above is what this
                knob will do once relations reach the EF.
              </span>
            </p>
          </ProcessSteps>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <CurvePlot
              tone="emerald"
              title="where · distance decay"
              f={(km) => whereScore(km, sm.where.defaultTolKm)}
              x0={0}
              x1={20}
              markers={[{ x: sm.where.defaultTolKm }]}
              xLabel="km → where"
              caption={`tol ${sm.where.defaultTolKm.toFixed(1)} · exp ${DIST_EXP}`}
            />
            <CurvePlot
              tone="emerald"
              title="when · wait (3 h open run)"
              f={(h) => whenAt(h)}
              x0={0}
              x1={12}
              markers={[{ x: 2 }]}
              xLabel="h until open → when"
              caption={`patience ${sm.when.patience.toFixed(2)}`}
            />
            <LadderPlot
              tone="emerald"
              title="what · the ladder"
              bars={[
                { label: "same", value: 1 },
                { label: "super", value: sm.what.tol },
                { label: "none", value: none },
              ]}
              caption="t · t²"
            />
          </div>
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">SM = where × when × what ∈ [0,1]</b> — multiplies
          EVERY lane. Structurally infeasible (closed, cross-town) → the card dies; the what
          ladder alone never vetoes (none floor = t²).
        </Prose>
      }
    />
  );
}
