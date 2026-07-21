"use client";

import { EM_ENCODER } from "@/lib/business/scores";
import { Chip, EmContextCols } from "../panel-ui";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// EM · Embeddings Match — the semantic gate (sky). Fully FIXED (v10): one
// encoder chip, no recall, inputs are documentation — no `save`, no save bar.

export function EmBox() {
  return (
    <SubscoreBox
      id="em"
      tint="sky"
      title="EM Subscore · Embeddings Match"
      overview={
        <Prose>
          The semantic gate every lane shares — how well the place matches who the consumer is
          and what they&apos;re asking (That), by MEANING, never by tags; reads TEXT only.
        </Prose>
      }
      hyperparams={
        <KnobGrid>
          <Chip
            label="Encoder · fixed"
            value={`${EM_ENCODER.model} · ${EM_ENCODER.dims}d`}
            hint="a decision, not a knob — a new encoder means a catalog re-embed"
          />
        </KnobGrid>
      }
      inputs={<EmContextCols />}
      process={
        <ProcessSteps>
          <p>1 · both sides become TEXT documents from the fields above — every live field, always</p>
          <p>2 · the encoder embeds each into a {EM_ENCODER.dims}-d UNIT vector</p>
          <p>3 · EM = max(0, cos(A, B)) against EVERY place in the consumer&apos;s metro — no recall cap; retrieval caps are Memo&apos;s config, never Lineup&apos;s</p>
        </ProcessSteps>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">EM ∈ [0,1]</b> — multiplies every lane; EM = 0 kills
          the card everywhere: money can&apos;t buy irrelevance.
        </Prose>
      }
    />
  );
}
