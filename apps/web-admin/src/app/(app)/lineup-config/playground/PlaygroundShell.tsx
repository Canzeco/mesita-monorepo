"use client";

import { useState } from "react";
import { Dices, Store, UserRound } from "lucide-react";
import type { IntentStyle } from "@/lib/business/cip";
import { useScoring } from "../ScoringProvider";
import { GroupHead } from "../panel-ui";
import { INTENT_STYLE_ICONS, SpecimenCell, type PlaygroundSpecimen } from "../playground-ui";
import { SubscorePlayground } from "../subscores/SubscorePlayground";
import { DeckPlayground } from "../lanes/DeckPlayground";

// Playground — both simulators under ONE shared specimen bar (decision D3):
// the same consumer × intent × roll drives the n = 1 Subscore section AND
// the full Deck run; the place picker feeds only the n = 1 section. Both
// sections read the CURRENT form values from the shared provider — edit a
// knob on Subscores, come back, watch it move. Nothing here writes config.

const INTENT_STYLES: readonly IntentStyle[] = ["browse", "viewport", "question"];

export function PlaygroundShell() {
  const { consumers, places } = useScoring();

  const [consumerIdx, setConsumerIdx] = useState(0);
  const [style, setStyle] = useState<IntentStyle>("browse");
  const [roll, setRoll] = useState(1);
  const [placeIdx, setPlaceIdx] = useState(0);
  const specimen: PlaygroundSpecimen = { consumerIdx, style, roll, placeIdx };

  const StyleIcon = INTENT_STYLE_ICONS[style];
  const selectCls =
    "border-border/70 bg-card w-full rounded-lg border px-2 py-1.5 text-[12px] font-medium";

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* The ONE specimen bar — drives both sections below */}
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <SpecimenCell icon={UserRound} tone="bg-violet-600 text-white" label="Consumer">
          <select
            aria-label="Consumer"
            className={selectCls}
            value={consumerIdx}
            onChange={(e) => setConsumerIdx(Number(e.target.value))}
          >
            {consumers.length === 0 ? <option value={0}>no consumers — synthetic</option> : null}
            {consumers.map((c, i) => (
              <option key={c.id} value={i}>
                {c.label ?? c.id.slice(0, 8)} · {c.class_key}
              </option>
            ))}
          </select>
        </SpecimenCell>
        <SpecimenCell icon={StyleIcon} tone="bg-sky-600 text-white" label="Intent">
          <div className="flex items-center gap-1.5">
            {INTENT_STYLES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStyle(s)}
                aria-pressed={style === s}
                className={
                  "rounded-md border px-2 py-1 text-[11px] font-semibold capitalize transition active:scale-[0.97] " +
                  (style === s
                    ? "border-primary/50 bg-primary/10"
                    : "border-border/60 text-muted-foreground hover:text-foreground")
                }
              >
                {s}
              </button>
            ))}
          </div>
        </SpecimenCell>
        <SpecimenCell icon={Store} tone="bg-emerald-600 text-white" label="Place · n = 1 only">
          <select
            aria-label="Place (n = 1 section only)"
            className={selectCls}
            value={placeIdx}
            onChange={(e) => setPlaceIdx(Number(e.target.value))}
          >
            {places.length === 0 ? <option value={0}>no places yet</option> : null}
            {places.map((p, i) => (
              <option key={p.id} value={i}>
                {p.name}
              </option>
            ))}
          </select>
        </SpecimenCell>
        <SpecimenCell icon={Dices} tone="bg-amber-600 text-white" label="Roll">
          <button
            type="button"
            onClick={() => setRoll((r) => r + 1)}
            className="border-border/70 hover:bg-muted inline-flex w-full items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-[12px] font-semibold transition active:scale-[0.98]"
          >
            <Dices className="h-3.5 w-3.5" aria-hidden /> Re-roll intent + XX · #{roll}
          </button>
        </SpecimenCell>
      </div>

      <SubscorePlayground specimen={specimen} />

      <GroupHead>Same specimen, whole pool — the full Lineup run below.</GroupHead>

      <DeckPlayground specimen={specimen} />
    </div>
  );
}
