"use client";

import { PIPELINE_CONTEXT, xxScore } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { Chip, ContextCols, Slider, SubscoreDataAccess } from "../panel-ui";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// XX · Random Number — the luck knob (violet).

export function XxBox() {
  const { xx, setXx, dataAccess, toggleSource } = useScoring();

  // XX's feel at the current control — median and the buried share.
  const median = Math.pow(0.5, xx.control);
  const buriedPct = xx.control <= 0 ? 0 : Math.round((1 - Math.pow(0.1, 1 / xx.control)) * 100);

  return (
    <SubscoreBox
      id="xx"
      tint="violet"
      title="XX Subscore · Random Number"
      pill={xx.control === 0 ? "default: off — pure merit" : `default control ${xx.control.toFixed(1)}`}
      overview={
        <Prose>
          The luck knob — how much randomness beats merit in the deck. The CONSUMER&apos;s
          Randomness filter is the real control; the admin sets only the green no-filter
          default.
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
            step={0.5}
            v={xx.control}
            onChange={(v) => setXx({ control: v })}
            hint={
              (xx.control === 0
                ? "off — every card draws XX = 1"
                : `median XX ${median.toFixed(3)} · ~${buriedPct}% of cards land below 0.1`) +
              " · GREEN = the consumer's Randomness filter overrides this per query"
            }
          />
          <Chip
            label="Ladder"
            value={`U¹ ${xxScore(0.5, 1).toFixed(2)} · U³ ${xxScore(0.5, 3).toFixed(2)} · U⁵ ${xxScore(0.5, 5).toFixed(3)}`}
            hint="the median card at control 1 / 3 / 5 — seeded per (card, lane, roll); live decks draw fresh"
          />
        </KnobGrid>
      }
      inputs={
        <>
          <ContextCols ctx={PIPELINE_CONTEXT.xx} />
          <SubscoreDataAccess subscore="xx" access={dataAccess} onToggle={toggleSource} />
        </>
      }
      process={
        <ProcessSteps>
          <p>U ~ Uniform[0,1) drawn fresh per card PER LANE — three independent draws</p>
          <p>XX = U^control · control 0 → XX ≡ 1 (off, pure merit) … 5 → near-total chaos</p>
          <p>seeded per (card, lane, roll) in the playgrounds; live decks draw fresh</p>
        </ProcessSteps>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">XX ∈ [0,1]</b> — multiplies every lane with its OWN
          draw. Higher control never changes WHO is luckiest, only how much luck beats merit.
        </Prose>
      }
    />
  );
}
