"use client";

import { PIPELINE_CONTEXT } from "@/lib/business/scores";
import { STRATEGIES } from "@/lib/business/strategies";
import { useScoring } from "../ScoringProvider";
import { ContextCols, Slider } from "../panel-ui";
import { LadderPlot } from "../plots";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// RP · Rewards Promotions — bought merit (rose).

export function RpBox() {
  const { rp, setRp } = useScoring();

  return (
    <SubscoreBox
      id="rp"
      save="rp"
      tint="rose"
      title="RP Subscore · Rewards Promotions"
      overview={
        <Prose>
          BOUGHT merit — the place&apos;s live promo rates (never shown to consumers) resolve to
          a posture, the posture to a rung.
        </Prose>
      }
      hyperparams={
        <KnobGrid cols={4}>
          {STRATEGIES.map((s) => (
            <Slider
              key={s.id}
              label={s.name}
              value={rp[s.id].toFixed(2)}
              min={0}
              max={1}
              step={0.05}
              v={rp[s.id]}
              onChange={(v) => setRp((p) => ({ ...p, [s.id]: Math.max(0, Math.min(1, v)) }))}
              hint={`the ${s.name.toLowerCase()} posture's rung`}
            />
          ))}
        </KnobGrid>
      }
      inputs={<ContextCols ctx={PIPELINE_CONTEXT.rp} />}
      process={
        <>
          <ProcessSteps>
            <p>live rates (welcome/returning × free/premium) → posture (Zero · Conservative · Aggressive · Dominant)</p>
            <p>posture → its rung above · custom/legacy rates that match no preset → the zero rung</p>
          </ProcessSteps>
          <LadderPlot
            tone="rose"
            title="posture → rung"
            bars={[
              { label: "zero", value: rp.zero },
              { label: "cons", value: rp.conservative },
              { label: "aggr", value: rp.aggressive },
              { label: "dom", value: rp.dominant },
            ]}
          />
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">RP ∈ [0,1]</b> — multiplies Inorganic + Hybrid;
          non-members never enter the paid lanes at all (a lane filter, not a score), and the
          zero-posture member keeps the whisper.
        </Prose>
      }
    />
  );
}
