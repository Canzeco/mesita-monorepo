"use client";

import {
  PIPELINE_CONTEXT,
  RANDOMNESS_LEVELS,
  XX_CONTROL_MAX,
  XX_CONTROL_MIN,
  type RandomnessLevelKey,
} from "@/lib/business/scores";
import { useScoring } from "../ScoringProvider";
import { ContextCols } from "../panel-ui";
import { LadderPlot } from "../plots";
import { ProcessSteps, Prose, SubscoreBox } from "./SubscoreBox";

// XX · Random Number — the luck knob (violet).
//
// A TABLE, not a dial (Pato 2026-08-09): the consumer's Randomness filter is a
// word ladder (low · medium · high · extra · max) and this box says what each
// word MEANS — one WHOLE control 0–5 per rung, picked from six buttons so a
// decimal can't be entered at all. `low` is the rung an untouched filter
// selects, so it is also what every query reads until the apps send the rung.

/** The six legal controls — the only values a rung may hold. */
const CONTROLS = Array.from(
  { length: XX_CONTROL_MAX - XX_CONTROL_MIN + 1 },
  (_, i) => XX_CONTROL_MIN + i,
);

/** What a control FEELS like, in one line of the box's own vocabulary. */
function feel(control: number): string {
  if (control <= 0) return "off — every card draws XX = 1 · pure merit";
  const median = Math.pow(0.5, control);
  const buriedPct = Math.round((1 - Math.pow(0.1, 1 / control)) * 100);
  return `median XX ${median.toFixed(3)} · ~${buriedPct}% of cards land below 0.1`;
}

function ControlPicker({
  level,
  value,
  onChange,
}: {
  level: RandomnessLevelKey;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={`${level} — XX control`}
      className="border-border flex shrink-0 overflow-hidden rounded-lg border"
    >
      {CONTROLS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          onClick={() => onChange(c)}
          className={
            "border-border h-7 w-7 border-r font-mono text-[12px] tabular-nums transition last:border-r-0 " +
            (value === c
              ? "bg-violet-600 font-semibold text-white"
              : "text-muted-foreground hover:bg-muted")
          }
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function XxBox() {
  const { xx, setXx } = useScoring();
  const setLevel = (key: RandomnessLevelKey, v: number) =>
    setXx((p) => ({ levels: { ...p.levels, [key]: v } }));

  return (
    <SubscoreBox
      id="xx"
      save="xx"
      tint="violet"
      title="XX · Random Number"
      pill={`ladder ${RANDOMNESS_LEVELS.map((k) => xx.levels[k]).join("·")}`}
      overview={
        <Prose>
          The luck knob — how much randomness beats merit. The CONSUMER&apos;s Randomness
          filter picks a rung (low → max); this table is what each rung MEANS. Whole
          numbers 0–5 only, and a query that names no rung reads <b>low</b>.
        </Prose>
      }
      hyperparams={
        <div className="border-border divide-border max-w-2xl divide-y overflow-hidden rounded-xl border">
          <div className="text-muted-foreground bg-muted/40 flex items-center gap-3 px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <span className="flex w-28 shrink-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-emerald-500"
                title="the consumer's filter picks the rung — the swipe/map EFs take it, but the apps don't send it yet (MESITA-738), so today every query reads low"
                aria-hidden
              />
              Randomness
            </span>
            <span className="w-[10.5rem] shrink-0">Control 0–5</span>
            <span>Feel</span>
          </div>
          {RANDOMNESS_LEVELS.map((key) => (
            <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
              <span className="text-foreground/80 w-28 shrink-0 text-[13px] font-medium">
                {key}
                {key === "low" ? (
                  <span className="text-muted-foreground ml-1.5 text-[10px]">no filter</span>
                ) : null}
              </span>
              <ControlPicker
                level={key}
                value={xx.levels[key]}
                onChange={(v) => setLevel(key, v)}
              />
              <p className="text-muted-foreground font-mono text-[10px] leading-snug">
                {feel(xx.levels[key])}
              </p>
            </div>
          ))}
        </div>
      }
      inputs={<ContextCols ctx={PIPELINE_CONTEXT.xx} />}
      process={
        <>
          <ProcessSteps>
            <p>U ~ Uniform[0,1) drawn fresh per card PER LANE — two independent draws</p>
            <p>the request&apos;s Randomness rung → its control in the table above (no rung → low)</p>
            <p>XX = U^control · control 0 → XX ≡ 1 (off, pure merit) … 5 → near-total chaos</p>
            <p>seeded per (seed, card, lane) — same arity as the EF; live decks pass a request seed</p>
          </ProcessSteps>
          <LadderPlot
            tone="violet"
            title="rung → median XX"
            bars={RANDOMNESS_LEVELS.map((key) => ({
              label: key,
              value: Math.pow(0.5, xx.levels[key]),
            }))}
            caption="median XX = 0.5^control — lower bar = luck beats merit harder"
          />
        </>
      }
      outputs={
        <Prose>
          <b className="text-foreground/80">XX ∈ [0,1]</b> — multiplies every lane with its OWN
          draw; a higher rung never changes WHO is luckiest, only how much luck beats merit.
        </Prose>
      }
    />
  );
}
