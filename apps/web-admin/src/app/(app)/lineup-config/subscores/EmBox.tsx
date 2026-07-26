"use client";

import { EMBEDDING_SYNTHESIS, EM_ENCODER } from "@/lib/business/scores";
import { Chip, EmContextCols } from "../panel-ui";
import { CurvePlot } from "../plots";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// EM · Embeddings Match — the semantic gate (sky). Fully FIXED (v10): one
// encoder chip, no recall, inputs are documentation — no `save`, no save bar.

export function EmBox() {
  return (
    <SubscoreBox
      id="em"
      tint="sky"
      title="EM · Embeddings Match"
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
        <>
          <ProcessSteps>
            <p>1 · both sides become TEXT documents from the fields above — every live field, always</p>
            <p>2 · the encoder embeds each into a {EM_ENCODER.dims}-d UNIT vector</p>
            <p>3 · EM = max(0, cos(A, B)) against EVERY place in the consumer&apos;s metro — no recall cap; retrieval caps are Memo&apos;s config, never Lineup&apos;s</p>
          </ProcessSteps>
          <CurvePlot
            tone="sky"
            title="EM = max(0, cos)"
            f={(cos) => Math.max(0, cos)}
            x0={-1}
            x1={1}
            markers={[{ x: 0 }]}
            xLabel="cos(A, B) → EM"
            caption="negative similarity clamps to 0"
          />

          {/* How the PLACE vector is built — the on-create/on-update blurb
              synthesis. The prompt is load-bearing, so it's shown verbatim. */}
          <div className="border-border/40 mt-4 border-t pt-3">
            <p className="text-foreground/70 font-mono text-[10px] font-semibold">
              Place vector · synthesized on create + on update
            </p>
            <ProcessSteps>
              <p>
                facts in → {EMBEDDING_SYNTHESIS.fields.join(" · ")} — NEVER{" "}
                {EMBEDDING_SYNTHESIS.excluded.join(" / ")}
              </p>
              <p>
                {EMBEDDING_SYNTHESIS.synthModel} writes a 1–3 sentence plain-text blurb, then{" "}
                {EM_ENCODER.model} embeds THAT blurb into the {EM_ENCODER.dims}-d vector
              </p>
              <p>re-embed only when the FACTS change (source hash) — never on LLM wording drift</p>
            </ProcessSteps>
            <div className="border-sky-200/70 bg-sky-50/60 mt-2 rounded-lg border px-3 py-2">
              <p className="text-muted-foreground text-[9px] font-bold tracking-[0.1em] uppercase">
                Synthesis prompt · {EMBEDDING_SYNTHESIS.synthModel} · temp 0
              </p>
              <p className="text-foreground/80 mt-1 font-mono text-[10px] leading-relaxed">
                &ldquo;{EMBEDDING_SYNTHESIS.prompt}&rdquo;
              </p>
            </div>
          </div>
        </>
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
