"use client";

import { EM_ENCODER } from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { Chip, ContextConfigCols, SubscoreDataAccess } from "../panel-ui";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// EM · Embeddings Match — the semantic gate (sky).

export function EmBox() {
  const { dataAccess, toggleSource, context, toggleContext } = useScoring();
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
          <Chip
            label="Encoder · fixed"
            value={`${EM_ENCODER.model} · ${EM_ENCODER.dims}d`}
            hint="a decision, not a knob — a new encoder means a catalog re-embed"
          />
          <Chip
            label="Recall · none"
            value="the whole metro catalog"
            hint="EM compares the query against ALL vectors — no top-K cap; the deck is capped later by the per-lane counts. Retrieval limits are Memo's config, not Lineup's."
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
          <p>2 · the encoder embeds each into a {EM_ENCODER.dims}-d UNIT vector</p>
          <p>3 · EM = max(0, cos(A, B)) against EVERY place in the consumer&apos;s metro — no recall cap; unit vectors, so cos is a plain dot product</p>
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
