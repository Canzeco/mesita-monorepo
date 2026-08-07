"use client";

import { PIPELINE_CONTEXT } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { ContextCols, Slider } from "../panel-ui";
import { CurvePlot } from "../plots";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// XX · Random Number — the luck knob (violet).

export function XxBox() {
  const { xx, setXx } = useScoring();

  // XX's feel at the current control — median and the buried share.
  const median = Math.pow(0.5, xx.control);
  const buriedPct = xx.control <= 0 ? 0 : Math.round((1 - Math.pow(0.1, 1 / xx.control)) * 100);

  return (
    <SubscoreBox
      id="xx"
      save="xx"
      tint="violet"
      title="XX · Random Number"
      pill={xx.control === 0 ? "default: off — pure merit" : `default control ${xx.control.toFixed(1)}`}
      overview={
        <Prose>
          The luck knob — how much randomness beats merit; the CONSUMER&apos;s Randomness filter
          is the real control, this green knob only its no-filter default.
        </Prose>
      }
      hyperparams={
        <KnobGrid>
          <Slider
            consumer
            label="Default control · no-filter value"
            value={xx.control.toFixed(1)}
            min={0}
            max={5}
            step={0.1}
            v={xx.control}
            onChange={(v) => setXx({ control: v })}
            hint={
              (xx.control === 0
                ? "off — every card draws XX = 1"
                : `median XX ${median.toFixed(3)} · ~${buriedPct}% of cards land below 0.1`) +
              " · applies to every card: the Randomness filter is not on the EFs yet, so this is a flat default, not a per-query fallback"
            }
          />
        </KnobGrid>
      }
      inputs={<ContextCols ctx={PIPELINE_CONTEXT.xx} />}
      process={
        <>
          <ProcessSteps>
            <p>U ~ Uniform[0,1) drawn fresh per card PER LANE — two independent draws</p>
            <p>XX = U^control · control 0 → XX ≡ 1 (off, pure merit) … 5 → near-total chaos</p>
            <p>seeded per (card, lane, roll) in the playgrounds; live decks draw fresh</p>
          </ProcessSteps>
          <CurvePlot
            tone="violet"
            title="XX = U^control"
            f={(u) => Math.pow(Math.max(0, Math.min(1, u)), xx.control)}
            x0={0}
            x1={1}
            markers={[{ x: 0.5 }]}
            xLabel="U ∈ [0,1] → XX"
            caption={
              xx.control === 0
                ? "control 0 — flat at 1 (off)"
                : `control ${xx.control.toFixed(1)} · median ${median.toFixed(2)}`
            }
          />
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">XX ∈ [0,1]</b> — multiplies every lane with its OWN
          draw; higher control never changes WHO is luckiest, only how much luck beats merit.
        </Prose>
      }
    />
  );
}
