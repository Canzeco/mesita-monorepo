"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CircleDashed,
  CircleSlash,
  Play,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { Button } from "@/components/admin-ui/config";
import { runApiHealthProbes } from "./actions";
import { ALL_PROBE_IDS, KNOWN_PROBES, type ProbeResult, type Verdict } from "./catalog";

const VERDICT_STYLE: Record<
  Verdict,
  { label: string; chip: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  ok: {
    label: "Healthy",
    chip: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700",
    Icon: ShieldCheck,
  },
  degraded: {
    label: "Throttled",
    chip: "border-amber-500/30 bg-amber-500/10 text-amber-700",
    Icon: TriangleAlert,
  },
  down: {
    label: "Failing",
    chip: "border-destructive/30 bg-destructive/10 text-destructive",
    Icon: AlertTriangle,
  },
  unconfigured: {
    label: "No key",
    chip: "border-border bg-muted text-muted-foreground",
    Icon: CircleSlash,
  },
};

function VerdictChip({ verdict }: { verdict: Verdict }) {
  const { label, chip, Icon } = VERDICT_STYLE[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 type-label font-semibold ${chip}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
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
    <div className="border-border bg-card flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display truncate text-sm font-semibold tracking-tight">
            {label}
          </h3>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {impact}
          </p>
        </div>
        {result ? (
          <VerdictChip verdict={result.verdict} />
        ) : (
          <span className="text-muted-foreground/60 inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 type-label font-medium">
            <CircleDashed className="h-3 w-3" />
            Not run
          </span>
        )}
      </div>

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
  );
}

export function BillingTestClient() {
  const [results, setResults] = useState<Record<string, ProbeResult>>({});
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [sweeping, setSweeping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notDeployed, setNotDeployed] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  /** @param sweep true when this is the "run everything" button, not one card. */
  async function run(ids: string[], sweep = false) {
    if (sweep) setSweeping(true);
    setRunning((prev) => new Set([...prev, ...ids]));
    setError(null);

    const res = await runApiHealthProbes(ids);

    if (res.ok) {
      setResults((prev) => {
        const next = { ...prev };
        for (const r of res.results) next[r.id] = r;
        return next;
      });
      setCheckedAt(res.checkedAt);
      setNotDeployed(false);
    } else {
      setError(res.error);
      setNotDeployed(res.notDeployed);
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
      <div className="border-border bg-card flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
        <div>
          <p className="text-sm font-semibold">Run every probe</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            All {KNOWN_PROBES.length} vendors at once. Two of them (Perplexity,
            Google Places) bill a token per run — pennies against not knowing
            who went dark.
            {checkedAt
              ? ` Last sweep ${new Date(checkedAt).toLocaleString()}.`
              : ""}
          </p>
        </div>
        <Button
          pending={sweeping}
          icon={<Play className="h-3.5 w-3.5" />}
          onClick={() => run([...ALL_PROBE_IDS], true)}
        >
          Run all tests
        </Button>
      </div>

      {notDeployed ? (
        <div className="border-amber-500/40 bg-amber-500/5 flex items-start gap-2 rounded-xl border p-3 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold">
              admin-web-check-api-health is not deployed.
            </span>{" "}
            Every card on this page is served by that one Edge Function, so
            nothing here can run until it ships:{" "}
            <code className="font-mono">
              supabase functions deploy admin-web-check-api-health
            </code>{" "}
            from the repo&apos;s <code className="font-mono">supabase/</code>{" "}
            package.
          </p>
        </div>
      ) : error ? (
        <ErrorNote message={error} />
      ) : null}

      <section>
        <h2 className="text-muted-foreground type-label font-medium tracking-[0.14em] uppercase">
          Vendors
        </h2>
        {/* Per-card Run stays: attributing an outage to one vendor is the whole
            point of the page, and after a key fix you want to retest that one. */}
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {KNOWN_PROBES.map((p) => (
            <ProbeCard
              key={p.id}
              label={p.label}
              impact={p.impact}
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
