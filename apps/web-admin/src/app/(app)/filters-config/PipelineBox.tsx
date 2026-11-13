// One Discovery pipeline box (MESITA-2327; laid out settings-first in
// MESITA-3819). Every box on the page is the same card: title, who runs it,
// one plain line, the recipe (reads from · keeps only · ranked by), then
// Settings and Save, and last a closed "How it works" holding Explanation,
// Sources, Signals, Gates, Factors, Always-on rules and Scoring, drawn
// straight from the model (discovery-surface.ts, the runtime's twin). Which source feeds
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

/** How a pipeline orders its rows, in a few words: its signals, then the
 *  Premier factor; a pipeline with no signal keeps Google's order. */
export function rankedBy(pipeline: DiscoveryPipelineKey): string {
  const p = DISCOVERY_PIPELINES.find((x) => x.key === pipeline);
  if (!p) return "";
  if (p.signals.length === 0) return "Google's order";
  const parts = p.signals.map((k) => signalByKey(k).label);
  if (p.factors.length > 0) parts.push("Premier");
  return parts.join(" × ");
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={`border-border inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        muted ? "text-muted-foreground" : "bg-background text-foreground"
      }`}
    >
      {children}
    </span>
  );
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
      <section
        id={id}
        aria-labelledby={`${id}-title`}
        className="border-border bg-card scroll-mt-16 overflow-hidden rounded-2xl border border-dashed"
      >
        <div className="flex items-center gap-3 px-4 py-4 sm:px-6">
          <span
            aria-hidden
            className="bg-muted/60 text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 id={`${id}-title`} className="font-display text-lg font-semibold tracking-tight">
              {title}{" "}
              <span className="bg-muted text-muted-foreground ml-1 rounded-full px-2 py-0.5 align-middle type-meta font-bold tracking-wider uppercase">
                Soon
              </span>
            </h2>
            <div className="text-muted-foreground type-meta">{explanation}</div>
          </div>
        </div>
      </section>
    );
  }
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="border-border bg-card scroll-mt-16 overflow-hidden rounded-2xl border"
    >
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex items-start gap-3">
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
        {summary ? <p className="text-foreground max-w-3xl text-sm leading-relaxed">{summary}</p> : null}
        <div className="border-border bg-muted/30 grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
          <RecipeCell label="Reads from">
            {p.sources.map((key) => (
              <Chip key={key}>{sourceLabel(key)}</Chip>
            ))}
          </RecipeCell>
          <RecipeCell label="Keeps only">
            {p.gates.length === 0 ? (
              <Chip muted>Open places of Mesita&apos;s types</Chip>
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

      {save ? <div className="border-border bg-muted/30 border-t px-4 pb-4 sm:px-6">{save}</div> : null}

      <details className="border-border group border-t">
        <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium sm:px-6 [&::-webkit-details-marker]:hidden">
          How it works
          <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">
            ›
          </span>
        </summary>

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
      </details>
    </section>
  );
}

/** The page's first card (MESITA-3819): one row per box, what it ranks by,
 *  and a jump to the box. */
export function DiscoveryOverview({
  rows,
}: {
  rows: readonly {
    href: string;
    icon: React.ReactNode;
    title: string;
    who: string;
    ranked: string;
    soon?: boolean;
  }[];
}) {
  return (
    <nav aria-label="Discovery pipelines" className="border-border bg-card overflow-hidden rounded-2xl border">
      <ul className="divide-border divide-y">
        {rows.map((r) => (
          <li key={r.href}>
            <a
              href={r.href}
              className="hover:bg-muted/40 flex items-center gap-3 px-4 py-3 sm:px-6"
            >
              <span
                aria-hidden
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                  r.soon ? "bg-muted/60 text-muted-foreground" : "bg-muted text-foreground"
                }`}
              >
                {r.icon}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold">
                  {r.title}
                  {r.soon ? (
                    <span className="bg-muted text-muted-foreground ml-2 rounded-full px-2 py-0.5 align-middle type-meta font-bold tracking-wider uppercase">
                      Soon
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground truncate type-meta">{r.who}</span>
              </span>
              <span className="text-muted-foreground hidden shrink-0 text-sm sm:block">{r.ranked}</span>
              <span aria-hidden className="text-muted-foreground shrink-0">
                ›
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
