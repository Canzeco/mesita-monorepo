// One Discovery pipeline box (MESITA-2327; laid out settings-first in
// MESITA-3819): title, who runs it, one plain line, the recipe (reads from ·
// keeps only · ranked by), then Settings and Save, and last a closed "How it
// works" (`HowItWorks`) holding Explanation, Sources, Signals, Gates,
// Factors, Always-on rules and Scoring, drawn straight from the model
// (discovery-surface.ts, the runtime's twin). The Searchbar boxes are
// PipelineBoxes; the "How places are ranked" card shows the Catalog's and
// the Map's HowItWorks (MESITA-4454). Which source feeds which signal is
// DERIVED from the sources' declared fields (`sourcesFeedingSignal`), never
// typed here; a source whose rows keep their own order feeds none
// (MESITA-2338).

import { Chip, Collapsible, SectionCard } from "@/components/admin-ui";
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
    <div className="border-border mt-4 flex flex-col gap-3 border-t pt-4">
      <p className="text-muted-foreground type-eyebrow">{label}</p>
      {children}
    </div>
  );
}

const sourceLabel = (key: Parameters<typeof sourceByKey>[0]) => sourceByKey(key).label;

/** How a pipeline orders its rows, in a few words: its signals, then the
 *  Premier factor; a pipeline with no signal keeps Google's order. */
function rankedBy(pipeline: DiscoveryPipelineKey): string {
  const p = DISCOVERY_PIPELINES.find((x) => x.key === pipeline);
  if (!p) return "";
  if (p.signals.length === 0) return "Google's order";
  const parts = p.signals.map((k) => signalByKey(k).label);
  if (p.factors.length > 0) parts.push("Premier");
  return parts.join(" × ");
}

function RecipeCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground type-meta">{label}</span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function PipelineBox({
  id,
  pipeline,
  title,
  icon,
  callers,
  summary,
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
  /** One plain line under the title: what the guest or admin gets. */
  summary?: React.ReactNode;
  explanation: React.ReactNode;
  /** Overrides the pipeline's Scoring line when this caller orders rows its
   *  own way (admin Find). */
  scoring?: string;
  /** Overrides the pipeline's always-on rules when this caller applies
   *  different ones (admin Find's Text Search column). */
  rules?: readonly string[];
  /** The Settings part (none when the pipeline is not live). */
  children?: React.ReactNode;
  /** The Save part. */
  save?: React.ReactNode;
}) {
  const p = DISCOVERY_PIPELINES.find((x) => x.key === pipeline);
  if (!p) return null;
  if (!p.live) {
    // Soon (MESITA-2345): the title, one line and the chip. Its controls are
    // deleted from the markup, not hidden (the ConfigSoon rule).
    return (
      <SectionCard
        id={id}
        icon={icon}
        title={title}
        right={<Chip>Soon</Chip>}
        className="scroll-mt-16"
      >
        <div className="text-muted-foreground mt-1 type-meta">{explanation}</div>
      </SectionCard>
    );
  }
  return (
    <SectionCard
      id={id}
      icon={icon}
      title={title}
      subtitle={`Run by ${(callers ?? p.callers).join(" · ")}`}
      className="scroll-mt-16"
    >
      <div className="mt-4 flex flex-col gap-4">
        {summary ? <p className="text-foreground max-w-3xl text-sm leading-relaxed">{summary}</p> : null}
        <div className="border-border bg-muted/30 grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
          <RecipeCell label="Reads from">
            {p.sources.map((key) => (
              <Chip key={key}>{sourceLabel(key)}</Chip>
            ))}
          </RecipeCell>
          <RecipeCell label="Keeps only">
            {p.gates.length === 0 ? (
              <Chip>Open places of Mesita&apos;s types</Chip>
            ) : (
              p.gates.map((key) => <Chip key={key}>{gateByKey(key).label}</Chip>)
            )}
          </RecipeCell>
          <RecipeCell label="Ranked by">
            <Chip>{scoring ? "Found by both first" : rankedBy(pipeline)}</Chip>
          </RecipeCell>
        </div>
      </div>

      <Part label="Settings">{children}</Part>

      {save ? <div>{save}</div> : null}

      <HowItWorks pipeline={pipeline} explanation={explanation} scoring={scoring} rules={rules} />
    </SectionCard>
  );
}

/** The closed "How it works" of one pipeline, drawn from the model. */
export function HowItWorks({
  pipeline,
  explanation,
  scoring,
  rules,
  summary = "How it works",
}: {
  pipeline: DiscoveryPipelineKey;
  explanation: React.ReactNode;
  scoring?: string;
  rules?: readonly string[];
  summary?: string;
}) {
  const p = DISCOVERY_PIPELINES.find((x) => x.key === pipeline);
  if (!p) return null;
  return (
    <Collapsible summary={summary}>
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
        {p.signals.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            None: no signal scores these rows; each keeps its source&apos;s own rank.
          </p>
        ) : null}
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

      {p.factors.length > 0 ? (
        <Part label="Factors">
          <ul className="flex flex-col gap-1.5 text-sm">
            {p.factors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
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
    </Collapsible>
  );
}
