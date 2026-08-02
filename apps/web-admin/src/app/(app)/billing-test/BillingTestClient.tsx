"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CircleDashed,
  CircleSlash,
  Coins,
  Loader2,
  Play,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { runApiHealthProbes } from "./actions";
import { KNOWN_PROBES, type ProbeResult, type Verdict } from "./catalog";

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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${chip}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function ProbeCard({
  label,
  impact,
  cost,
  result,
  busy,
  onRun,
}: {
  label: string;
  impact: string;
  cost: "free" | "paid";
  result: ProbeResult | undefined;
  busy: boolean;
  onRun: () => void;
}) {
  return (
    <div className="border-border bg-card shadow-elev flex flex-col gap-3 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display truncate text-sm font-semibold tracking-tight">
              {label}
            </h3>
            {cost === "paid" ? (
              <span className="border-border text-muted-foreground inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
                <Coins className="h-2.5 w-2.5" />
                billed
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
            {impact}
          </p>
        </div>
        {result ? (
          <VerdictChip verdict={result.verdict} />
        ) : (
          <span className="text-muted-foreground/60 inline-flex items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-[11px] font-medium">
            <CircleDashed className="h-3 w-3" />
            Not run
          </span>
        )}
      </div>

      {result ? (
        <div className="border-border/60 bg-muted/30 rounded-xl border p-3">
          <p className="text-foreground text-xs leading-relaxed">{result.detail}</p>
          <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
            {result.httpStatus !== null ? <span>HTTP {result.httpStatus}</span> : null}
            {result.latencyMs !== null ? <span>{result.latencyMs} ms</span> : null}
            {result.envKeys.length > 0 ? (
              <span className="font-mono">{result.envKeys.join(" / ")}</span>
            ) : null}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRun}
        disabled={busy}
        className="border-border hover:bg-muted inline-flex h-8 items-center justify-center gap-1.5 self-start rounded-full border px-3 text-xs font-semibold transition disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Play className="h-3 w-3" />
        )}
        {cost === "paid" ? "Run (spends)" : "Run"}
      </button>
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

  async function run(providers: string[] | null) {
    const ids = providers ?? KNOWN_PROBES.filter((p) => p.cost === "free").map((p) => p.id);
    if (providers === null) setSweeping(true);
    setRunning((prev) => new Set([...prev, ...ids]));
    setError(null);

    const res = await runApiHealthProbes(providers);

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
    if (providers === null) setSweeping(false);
  }

  const free = KNOWN_PROBES.filter((p) => p.cost === "free");
  const paid = KNOWN_PROBES.filter((p) => p.cost === "paid");

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border bg-card shadow-elev flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
        <div>
          <p className="text-sm font-semibold">Run every free probe</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Account and balance endpoints only — vendors don&apos;t bill for these.
            {checkedAt
              ? ` Last sweep ${new Date(checkedAt).toLocaleString()}.`
              : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => run(null)}
          disabled={sweeping}
          className="bg-foreground text-background inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 text-xs font-semibold transition hover:opacity-90 disabled:opacity-50"
        >
          {sweeping ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          Run free sweep
        </button>
      </div>

      {notDeployed ? (
        <div className="border-amber-500/40 bg-amber-500/5 flex items-start gap-2 rounded-xl border p-3 text-xs text-amber-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p className="leading-relaxed">
            <span className="font-semibold">
              admin-web-check-api-health is not deployed.
            </span>{" "}
            The Supabase org is on the free plan and already carries more Edge
            Functions than that plan allows, so every deploy — including this
            one — is rejected with a 402. This page works the moment the org
            moves to Pro and the function ships; nothing else is required.
          </p>
        </div>
      ) : error ? (
        <ErrorNote message={error} />
      ) : null}

      <section>
        <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
          Free probes
        </h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {free.map((p) => (
            <ProbeCard
              key={p.id}
              label={p.label}
              impact={p.impact}
              cost={p.cost}
              result={results[p.id]}
              busy={running.has(p.id)}
              onRun={() => run([p.id])}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-muted-foreground text-[11px] font-medium tracking-[0.14em] uppercase">
          Billed probes
        </h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          These vendors expose no unbilled endpoint that proves a key still
          works, so each run spends a token or a request unit. They are excluded
          from the sweep above and only run when you press their own button.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {paid.map((p) => (
            <ProbeCard
              key={p.id}
              label={p.label}
              impact={p.impact}
              cost={p.cost}
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
