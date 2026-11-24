"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Button, Chip, type ChipTone, Notice, SectionCard } from "@/components/admin-ui";
import { runApiHealthProbes } from "./actions";
import { ALL_PROBE_IDS, KNOWN_PROBES, type ProbeResult, type Verdict } from "./catalog";

const VERDICT_STYLE: Record<Verdict, { label: string; tone: ChipTone }> = {
  ok: { label: "Healthy", tone: "success" },
  degraded: { label: "Throttled", tone: "warning" },
  down: { label: "Failing", tone: "danger" },
  unconfigured: { label: "No key", tone: "neutral" },
};

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const { label, tone } = VERDICT_STYLE[verdict];
  return <Chip tone={tone}>{label}</Chip>;
}

function ProbeCard({
  label,
  impact,
  result,
  busy,
  onRun,
}: {
  label: string;
  impact: string;
  result: ProbeResult | undefined;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <SectionCard
      title={label}
      subtitle={impact}
      right={
        result ? (
          <VerdictChip verdict={result.verdict} />
        ) : (
          // Not a state, the absence of one: muted text, so it never shares
          // the neutral chip with "No key" on a neighbouring card.
          <span className="text-muted-foreground type-meta font-semibold">Not run</span>
        )
      }
    >
      <div className="mt-4 flex flex-col gap-3">
        {result ? (
          <div className="border-border/60 bg-muted/30 rounded-xl border p-3">
            <p className="text-foreground text-xs leading-relaxed">{result.detail}</p>
            <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 type-meta">
              {result.httpStatus !== null ? <span>HTTP {result.httpStatus}</span> : null}
              {result.latencyMs !== null ? <span>{result.latencyMs} ms</span> : null}
              {result.envKeys.length > 0 ? (
                <span className="font-mono">{result.envKeys.join(" / ")}</span>
              ) : null}
            </div>
          </div>
        ) : null}

        <Button
          tone="secondary"
          size="sm"
          pending={busy}
          icon={<Play className="h-3 w-3" />}
          onClick={onRun}
        >
          Run
        </Button>
      </div>
    </SectionCard>
  );
}

export function BillingTestClient() {
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  /** @param sweep true when this is the "run everything" button, not one card. */
  async function run(ids: string[], sweep = false) {
    if (sweep) setSweeping(true);
    setRunning((prev) => new Set([...prev, ...ids]));
    setError(null);

    const res = await runApiHealthProbes(ids).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : String(e) }));

    if (res.ok) {
      setResults((prev) => {
        const next = { ...prev };
        for (const r of res.results) next[r.id] = r;
        return next;
      });
      if (sweep) setCheckedAt(res.checkedAt);
    } else {
      setError(res.error);
    }

    setRunning((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    if (sweep) setSweeping(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Run every probe"
        subtitle={
          <>
            All {KNOWN_PROBES.length} vendors at once. Two of them (Perplexity,
            Google Places) bill a token per run — pennies against not knowing
            who went dark.
            {checkedAt
              ? ` Last sweep ${new Date(checkedAt).toLocaleString()}.`
              : ""}
          </>
        }
        right={
          <Button
            pending={sweeping}
            icon={<Play className="h-3.5 w-3.5" />}
            onClick={() => run([...ALL_PROBE_IDS], true)}
          >
            Run all tests
          </Button>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <section>
        <h2 className="text-muted-foreground type-eyebrow">
          Vendors
        </h2>
        {/* Per-card Run stays: attributing an outage to one vendor is the whole
            point of the page, and after a key fix you want to retest that one. */}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {KNOWN_PROBES.map((p) => (
            <ProbeCard
              key={p.id}
              label={p.label}
              impact={results[p.id]?.impact || p.impact}
              result={results[p.id]}
              busy={running.has(p.id)}
              onRun={() => run([p.id])}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
