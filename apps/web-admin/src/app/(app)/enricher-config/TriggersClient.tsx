"use client";

import { useState, useTransition } from "react";
import { Lock, Radio, ShieldQuestion } from "lucide-react";
import {
  type EnrichmentTriggersConfig,
  type EnrichmentTriggersMeta,
  updateEnrichmentTriggers,
} from "./actions";
import { ErrorNote } from "@/components/ErrorNote";
import { KnobStatus, SaveRow, SectionCard, Switch } from "./atlas-ui";

const COST_LABEL: Record<string, string> = {
  free: "free",
  low: "$",
  high: "$$",
};

// A cheap trigger that buys an expensive column is the one mistake this page
// can make that costs real money, so the grid says so out loud rather than
// leaving it to be discovered on the invoice.
const HIGH_FREQUENCY = new Set(["on_visit", "on_order", "on_reservation_ok"]);

export function EnrichmentTriggersClient({
  initialConfig,
  meta,
  loadError,
}: {
  initialConfig: EnrichmentTriggersConfig;
  meta: EnrichmentTriggersMeta;
  loadError?: string | null;
}) {
  const [cfg, setCfg] = useState<EnrichmentTriggersConfig>(initialConfig);
  const [dirty, setDirty] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const patchRow = (
    trigger: string,
    next: Partial<EnrichmentTriggersConfig[string]>,
  ) => {
    setCfg((prev) => ({ ...prev, [trigger]: { ...prev[trigger], ...next } }));
    setDirty(true);
    setOk(false);
  };

  const toggleCell = (trigger: string, sub: string) => {
    setCfg((prev) => {
      const row = prev[trigger];
      return {
        ...prev,
        [trigger]: {
          ...row,
          subprocesses: {
            ...row.subprocesses,
            [sub]: !row.subprocesses[sub],
          },
        },
      };
    });
    setDirty(true);
    setOk(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      const r = await updateEnrichmentTriggers(cfg);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      // The EF normalizes (locked cells forced, unknown keys dropped), so adopt
      // what it stored rather than what we sent.
      setCfg(r.data);
      setDirty(false);
      setOk(true);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={<Radio className="h-4 w-4" />}
        title="Trigger matrix"
        subtitle="Which event re-runs which part of the pipeline. Enrichment is not one button: a first-time create earns every subprocess, while a guest walking in earns a cheap Google refresh and nothing else."
        status={
          <KnobStatus
            kind="enforced"
            reason="seeded onto place_research.subprocesses; the three stage EFs skip what a run did not buy"
          />
        }
      >
        <div className="border-border overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-border bg-muted/40 border-b">
                <th className="px-3 py-2.5 text-left font-semibold">Trigger</th>
                <th className="px-2 py-2.5 text-center font-semibold">On</th>
                <th className="px-2 py-2.5 text-center font-semibold">Cooldown</th>
                {meta.subprocesses.map((s) => (
                  <th key={s.key} className="px-2 py-2.5 text-center font-semibold">
                    <span title={s.blurb} className="block cursor-help">
                      {s.label}
                    </span>
                    <span className="text-muted-foreground block text-[10px] font-normal tabular-nums">
                      {s.step} · {COST_LABEL[s.cost] ?? s.cost}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meta.triggers.map((t) => {
                const row = cfg[t.key];
                if (!row) return null;
                const locks = meta.locks[t.key] ?? {};
                const spendsOnHighFrequency = HIGH_FREQUENCY.has(t.key) &&
                  meta.subprocesses.some(
                    (s) => s.cost === "high" && row.subprocesses[s.key],
                  );
                return (
                  <tr key={t.key} className="border-border border-b last:border-0">
                    <td className="max-w-[260px] px-3 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{t.label}</span>
                        {t.staged && (
                          <span className="border-border text-muted-foreground rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
                            Staged
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                        {t.blurb}
                      </p>
                      {t.staged && (
                        <p className="text-muted-foreground mt-1 text-[11px] italic">
                          No emitter yet — the row is saved and read, but nothing
                          fires it.
                        </p>
                      )}
                      {spendsOnHighFrequency && (
                        <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-500">
                          This event can fire many times a day and is buying a $$
                          subprocess.
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-3 text-center align-top">
                      <Switch
                        on={row.enabled}
                        pending={pending}
                        onClick={() =>
                          patchRow(t.key, { enabled: !row.enabled })}
                        label={`${t.label} enabled`}
                      />
                    </td>
                    <td className="w-28 px-2 py-3 align-top">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={8760}
                          value={row.cooldownHours}
                          disabled={!row.enabled}
                          aria-label={`${t.label} cooldown in hours`}
                          onChange={(e) => {
                            const raw = Number(e.target.value);
                            if (Number.isNaN(raw)) return;
                            patchRow(t.key, {
                              cooldownHours: Math.max(
                                0,
                                Math.min(8760, Math.round(raw)),
                              ),
                            });
                          }}
                          className="border-border bg-card focus:border-foreground h-9 w-16 rounded-lg border px-2 text-right text-sm tabular-nums outline-none disabled:opacity-50"
                        />
                        <span className="text-muted-foreground text-xs">h</span>
                      </div>
                    </td>
                    {meta.subprocesses.map((s) => {
                      const lock = locks[s.key];
                      const checked = lock ? lock.value : !!row.subprocesses[s.key];
                      return (
                        <td key={s.key} className="px-2 py-3 text-center align-top">
                          {lock
                            ? (
                              <span
                                title={lock.reason}
                                className="text-muted-foreground inline-flex cursor-help items-center gap-1 text-xs"
                              >
                                <Lock className="h-3 w-3" />
                                {lock.value ? "on" : "off"}
                              </span>
                            )
                            : (
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!row.enabled}
                                onChange={() => toggleCell(t.key, s.key)}
                                className="border-border h-4 w-4 rounded disabled:opacity-40"
                                aria-label={`${t.label} · ${s.label}`}
                              />
                            )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && <ErrorNote message={error} />}
        <SaveRow
          pending={pending}
          dirty={dirty}
          ok={ok}
          onClick={save}
          loadError={loadError}
        />
      </SectionCard>

      <SectionCard
        icon={<ShieldQuestion className="h-4 w-4" />}
        title="Corrections"
        subtitle="What an agent LEARNS, as opposed to what the pipeline re-fetches. When the Reservationist hears on a call that the hours are wrong, re-running the pipeline refetches the same wrong hours from Google — the agent knows something no source does."
        status={
          <KnobStatus
            kind="not-wired"
            reason="no proposals table, no writer, no reader — types only, in _shared/enrich-corrections.ts"
          />
        }
      >
        <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
          A correction is a proposed field write carrying its source, a
          confidence and the evidence behind it. Above the source&rsquo;s floor it
          applies itself; below it, it queues for a human in Verification.
          Applying one <strong>pins</strong> the field, and the pin is the point:
          without it the next scheduled run silently reverts the correction and
          every call is wrong again.
        </p>
        <p className="text-muted-foreground mt-3 max-w-3xl text-sm leading-relaxed">
          Deliberately not a row in the grid above. A trigger re-derives; a
          correction overrides. Merging them is how a corrected place quietly
          goes back to being wrong.
        </p>
      </SectionCard>
    </div>
  );
}
