"use client";

import { EM_ENCODER } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { Chip, ContextConfigCols, Slider, SubscoreDataAccess } from "../panel-ui";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// EM · Embeddings Match — the semantic gate (sky).

export function EmBox() {
  const { recallTopK, setRecallTopK, dataAccess, toggleSource, context, toggleContext } =
    useScoring();
  const emSet = new Set(context.em);

  return (
    <SubscoreBox
      id="em"
      tint="sky"
      title="EM Subscore · Embeddings Match"
      pill={`${context.em.length} fields in context`}
      overview={
        <Prose>
          The semantic gate every lane shares — how well this place matches who the consumer is
          and what they&apos;re asking (That), by MEANING, never by tags. Reads TEXT only.
        </Prose>
      }
      hyperparams={
        <KnobGrid>
          <Slider
            label="Recall top-K"
            value={String(recallTopK)}
            min={10}
            max={200}
            step={10}
            v={recallTopK}
            onChange={setRecallTopK}
            hint="places recalled per query (metro-filtered) — the lanes score these"
          />
          <Chip
            label="Encoder · fixed"
            value={`${EM_ENCODER.model} · ${EM_ENCODER.dims}d`}
            hint="a decision, not a knob — a new encoder means a catalog re-embed"
          />
        </KnobGrid>
      }
      inputs={
        <>
          <ContextConfigCols enabled={emSet} onToggle={toggleContext} />
          <SubscoreDataAccess subscore="em" access={dataAccess} onToggle={toggleSource} />
        </>
      }
      process={
        <ProcessSteps>
          <p>1 · both sides become TEXT documents from exactly the enabled fields above</p>
          <p>2 · the encoder embeds each into a {EM_ENCODER.dims}-d UNIT vector (pgvector at recall)</p>
          <p>3 · EM = max(0, cos(A, B)) — unit vectors, so cos is a plain dot product</p>
          <p>the playground emulates the encoder with a deterministic feature hash</p>
        </ProcessSteps>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">EM ∈ [0,1]</b> — multiplies EVERY lane (Organic ·
          Inorganic · Hybrid). EM = 0 kills the card in all three: money can&apos;t buy
          irrelevance.
        </Prose>
      }
    />
  );
}
