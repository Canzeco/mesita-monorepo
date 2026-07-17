"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";
import { runCongruency, type CongruencyResult } from "@/lib/business/congruency";
import { useScoring } from "../ScoringProvider";
import { PanelCard, SubHead } from "../panel-ui";

// Congruency — is the console congruent with the agreed spec? Runs against
// the LIVE form state (the shared provider), so dragging a knob off an
// agreed value shows its drift instantly, before any save. Structural
// failures are bugs (red); locked-value mismatches are drift (amber) —
// legal to save, but no longer the model we agreed on.

const STATUS_TONE: Record<CongruencyResult["status"], string> = {
  pass: "border-emerald-300/80 bg-emerald-50 text-emerald-700",
  drift: "border-amber-300/80 bg-amber-50 text-amber-700",
  fail: "border-red-300/80 bg-red-50 text-red-700",
};

function Row({ r }: { r: CongruencyResult }) {
  return (
    <div className="border-border/40 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b px-2.5 py-1.5 last:border-0">
      <span
        className={
          "inline-flex w-12 shrink-0 items-center justify-center rounded-md border px-1 py-0.5 font-mono text-[9px] font-bold uppercase " +
          STATUS_TONE[r.status]
        }
      >
        {r.status}
      </span>
      <span className="min-w-0 flex-1 text-[11.5px] leading-snug">{r.label}</span>
      <span className="text-muted-foreground shrink-0 font-mono text-[10px]" title="expected (the spec)">
        spec {r.expected}
      </span>
      {r.status !== "pass" ? (
        <span className="shrink-0 font-mono text-[10px] font-semibold" title="actual (this console)">
          now {r.actual}
        </span>
      ) : null}
    </div>
  );
}

export function CongruencyCard() {
  const { current } = useScoring();

  const results = useMemo(() => runCongruency(current), [current]);
  const structural = results.filter((r) => r.group === "structural");
  const lockedVals = results.filter((r) => r.group === "locked");
  const fails = results.filter((r) => r.status === "fail").length;
  const drifts = results.filter((r) => r.status === "drift").length;

  const pill =
    fails > 0
      ? `${fails} failed · ${drifts} drifted`
      : drifts > 0
        ? `${drifts} drifted from spec`
        : `${results.length}/${results.length} congruent`;

  const HeadIcon = fails > 0 ? AlertTriangle : drifts > 0 ? TriangleAlert : ShieldCheck;

  return (
    <PanelCard
      title="Congruency · spec vs console"
      subtitle="Every agreed decision from the Scoring spec, checked against this console LIVE — structural checks prove the model code behaves as specified (a failure is a bug); locked-value checks compare the current knobs to the agreed numbers (a mismatch is drift: legal, but no longer the agreed model). Drag any slider above and watch its row flip."
      pill={pill}
    >
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
            <SubHead>Structural — the code&apos;s behavior</SubHead>
          </div>
          <div className="border-border/50 mt-2 rounded-xl border">
            {structural.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <HeadIcon className="text-muted-foreground h-3.5 w-3.5" aria-hidden />
            <SubHead>Locked values — the agreed numbers</SubHead>
          </div>
          <div className="border-border/50 mt-2 rounded-xl border">
            {lockedVals.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </div>
          <p className="text-muted-foreground mt-2 font-mono text-[10px] leading-relaxed">
            e.g. the encoder was AGREED: text-embedding-3-small at its native 1536 dims — move
            the dims slider and this drifts amber until it&apos;s back on spec.
          </p>
        </div>
      </div>
    </PanelCard>
  );
}
