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
      title="RP · Rewards Promotions"
      overview={
        <Prose>
          BOUGHT merit — the place&apos;s live promo rates (never shown to consumers) resolve to
          a strategy, the strategy to a rung.
        </Prose>
      }
      hyperparams={
        <KnobGrid cols={3}>
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
              hint={`the ${s.name.toLowerCase()} strategy's rung`}
            />
          ))}
        </KnobGrid>
      }
      inputs={<ContextCols ctx={PIPELINE_CONTEXT.rp} />}
      process={
        <>
          <ProcessSteps>
            <p>live rates (welcome/returning × standard/premium) → strategy (Zero · Conservative · Aggressive)</p>
            <p>strategy → its rung above · custom/legacy rates that match no preset → the zero rung</p>
          </ProcessSteps>
          <LadderPlot
            tone="rose"
            title="strategy → rung"
            bars={[
              { label: "zero", value: rp.zero },
              { label: "cons", value: rp.conservative },
              { label: "aggr", value: rp.aggressive },
            ]}
          />
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">RP ∈ [0,1]</b> — multiplies the Inorganic lane;
          non-members never enter it at all (a lane filter, not a score), and the zero-strategy
          member keeps the whisper.
        </Prose>
      }
    />
  );
}
