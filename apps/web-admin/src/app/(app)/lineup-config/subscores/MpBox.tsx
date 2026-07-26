"use client";

import { DEFAULT_MANUAL_PRIORITY, PIPELINE_CONTEXT } from "@/lib/business/scores";
import { Chip, ContextCols } from "../panel-ui";
import { LadderPlot } from "../plots";
import { KnobGrid, ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// MP · Manual Priority — the operator's override on every lane (teal). NOT a
// global blob knob: MP is per-place DATA (places.manual_priority), so this box
// documents it and renders no save bar. The value is set per place in the
// place editor's Scores tab; every untouched place sits at the default 0.1.

export function MpBox() {
  const d = DEFAULT_MANUAL_PRIORITY;
  return (
    <SubscoreBox
      id="mp"
      tint="teal"
      title="MP · Manual Priority"
      pill={`default ${d.toFixed(2)} · per place`}
      overview={
        <Prose>
          The operator&apos;s thumb on the scale — a per-place priority the super-admin sets to
          surface specific places, multiplying EVERY lane. Not a global knob: it is a value ON
          the place, set in the place editor. Every place a human hasn&apos;t touched sits at{" "}
          {d.toFixed(2)}.
        </Prose>
      }
      hyperparams={
        <KnobGrid>
          <Chip
            label="No global knob"
            value={`per place · default ${d.toFixed(2)}`}
            hint="MP is not tuned here — it is a per-place value (places.manual_priority). Set a place's priority in Manage → Place → Scores. The 0.1 default is the DB baseline for untouched places."
          />
        </KnobGrid>
      }
      inputs={<ContextCols ctx={PIPELINE_CONTEXT.mp} />}
      process={
        <>
          <ProcessSteps>
            <p>MP = the place&apos;s manual_priority, clamped to [0,1] · unset → {d.toFixed(2)}</p>
            <p>
              no consumer, no query, no curve — a straight operator value; raise it to lift a
              place, leave it at {d.toFixed(2)} for the baseline
            </p>
          </ProcessSteps>
          <LadderPlot
            tone="teal"
            title="MP is a per-place value (examples)"
            bars={[
              { label: "default", value: d },
              { label: "nudged", value: 0.4 },
              { label: "pushed", value: 0.7 },
              { label: "forced", value: 1 },
            ]}
            caption="not a knob — the admin sets each place's value"
          />
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">MP ∈ [0,1]</b> — multiplies both lanes (Organic ·
          Inorganic), like EM and SM. At the {d.toFixed(2)} baseline every place is scaled equally
          (relative order unchanged); a raised MP lifts that place across both lanes. MP = 0
          would bury a place everywhere.
        </Prose>
      }
    />
  );
}
