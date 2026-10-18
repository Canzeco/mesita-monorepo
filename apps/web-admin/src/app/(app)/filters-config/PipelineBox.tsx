// One Discovery pipeline box (MESITA-2327). Every box on the page is the same
// card: who runs it, Explanation, then its Sources, Signals, Gates and
// always-on Rules drawn straight from the model (discovery-surface.ts, the
// runtime's twin), then Scoring, Parameters and Save. Which source feeds
// which signal is DERIVED from the sources' declared fields
// (`sourcesFeedingSignal`), never typed here; a source whose rows keep their
// own order feeds none (MESITA-2338).

import { KnobState } from "@/components/admin-ui/config";
import {
  DISCOVERY_FIELD_LABELS,
  DISCOVERY_PIPELINES,
  type DiscoveryPipelineKey,
  gateByKey,
  pipelinesUsingSignal,
  signalByKey,
  sourceByKey,
  sourcesFeedingSignal,
} from "./discovery-surface";

const COMPUTATION: Record<"runtime" | "precomputed" | "hybrid", string> = {
  runtime: "Computed at request time",
  precomputed: "Precomputed",
  hybrid: "Precomputed place side, computed at request time",
};

const pipelineLabel = (key: DiscoveryPipelineKey) =>
  DISCOVERY_PIPELINES.find((p) => p.key === key)?.label ?? key;

function Part({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-border flex flex-col gap-3 border-t px-4 py-4 sm:px-6">
      <p className="text-muted-foreground type-meta font-semibold tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

const sourceLabel = (key: Parameters<typeof sourceByKey>[0]) => sourceByKey(key).label;

export function PipelineBox({
  id,
  pipeline,
  title,
  icon,
  callers,
  explanation,
  scoring,
  rules,
  children,
  save,
}: {
  id: string;
  pipeline: DiscoveryPipelineKey;
  title: string;
  icon: React.ReactNode;
  /** Who runs this box's configuration; defaults to the pipeline's callers. */
  callers?: readonly string[];
  explanation: React.ReactNode;
  /** Overrides the pipeline's Scoring line when this caller orders rows its
   *  own way (admin Find). */
  scoring?: string;
  /** Overrides the pipeline's always-on rules when this caller applies
   *  different ones (admin Find's Text Search column). */
  rules?: readonly string[];
  /** The Parameters part. */
  children: React.ReactNode;
  /** The Save part. */
  save?: React.ReactNode;
}) {
  const p = DISCOVERY_PIPELINES.find((x) => x.key === pipeline);
  if (!p) return null;
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-border bg-card scroll-mt-16 overflow-hidden rounded-2xl border"
    >
      <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
        <span
          aria-hidden
          className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="font-display text-lg font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-muted-foreground type-meta">
            Run by {(callers ?? p.callers).join(" · ")}
          </p>
        </div>
      </div>

      <Part label="Explanation">
        <div className="text-foreground max-w-3xl text-sm leading-relaxed">{explanation}</div>
      </Part>

      <Part label="Sources">
        <ul className="flex flex-col gap-3">
          {p.sources.map((key) => {
            const s = sourceByKey(key);
            return (
              <li key={key} className="flex flex-col gap-0.5 text-sm">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{s.label}</span>
                  {!s.live ? <KnobState kind="not-wired" reason="No engine retrieves this yet" /> : null}
                </span>
                <span className="text-muted-foreground">{s.retrieves}</span>
                <span className="text-muted-foreground type-meta">
                  Gives {s.provides.map((f) => DISCOVERY_FIELD_LABELS[f]).join(" · ")}
                </span>
                {p.keepsOrder.includes(key) ? (
                  <span className="text-muted-foreground type-meta">
                    No signal scores its rows; they carry {s.label}&apos;s own rank.
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Part>

      <Part label="Signals">
        <ul className="flex flex-col gap-3">
          {p.signals.map((key) => {
            const sig = signalByKey(key);
            const fed = sourcesFeedingSignal(pipeline, key);
            return (
              <li key={key} className="flex flex-col gap-0.5 text-sm">
                <span className="font-semibold">{sig.label}</span>
                <code className="bg-muted w-fit rounded-md px-2 py-0.5 text-xs">{sig.formula}</code>
                <span className="text-muted-foreground">
                  Reads {sig.requires.map((f) => DISCOVERY_FIELD_LABELS[f]).join(" · ")} · asks{" "}
                  {sig.query}
                </span>
                <span className="text-muted-foreground">Missing data: {sig.missing}</span>
                <span className="text-muted-foreground">Normalization: {sig.normalization}</span>
                <span className="text-muted-foreground type-meta">
                  {COMPUTATION[sig.computation]}. {sig.cost} Fed by{" "}
                  {fed.map(sourceLabel).join(" · ")}. Used by{" "}
                  {pipelinesUsingSignal(key).map(pipelineLabel).join(" · ")}.
                </span>
              </li>
            );
          })}
        </ul>
      </Part>

      {p.gates.length > 0 ? (
        <Part label="Gates">
          <ul className="flex flex-col gap-3">
            {p.gates.map((key) => {
              const g = gateByKey(key);
              return (
                <li key={key} className="flex flex-col gap-0.5 text-sm">
                  <span className="font-semibold">
                    {g.label}{" "}
                    <span className="text-muted-foreground font-normal">
                      · {g.kind === "intrinsic" ? "a stored fact" : "depends on the request"}
                    </span>
                  </span>
                  <span>{g.rule}</span>
                  <span className="text-muted-foreground">{g.when}</span>
                  <span className="text-muted-foreground">Missing data: {g.missing}</span>
                  <span className="text-muted-foreground type-meta">
                    Pushed down into {g.pushdown.map(sourceLabel).join(" · ")}; re-checked after, so every
                    source obeys the same rule.
                  </span>
                </li>
              );
            })}
          </ul>
        </Part>
      ) : null}

      <Part label="Always-on rules">
        <ul className="flex flex-col gap-1.5 text-sm">
          {(rules ?? p.rules).map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </Part>

      <Part label="Scoring">
        <p className="text-sm">{scoring ?? p.scoring}</p>
      </Part>

      <Part label="Parameters">{children}</Part>

      {save ? <div className="border-border bg-muted/30 border-t px-4 pb-4 sm:px-6">{save}</div> : null}
    </section>
  );
}
