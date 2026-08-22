"use client";

// Enrichment · Runs — the trigger × subprocess matrix, folded in as a BOX.
//
// Pato asked for this to be deleted ("delete the triggers shit") and it could
// not be, so the honest thing is to say why in the file that survived.
//
// on_create and on_schedule are LIVE emitters: `create-place.ts` resolves
// subprocessesFor(triggers, "on_create") on every place born through four EFs
// and hard-skips the first run when the row is off, and the deployed
// queue_due_place_enrichments() reads the on_schedule row every 15 minutes and
// queues nothing when it is disabled. The resolved list is then obeyed by
// eight gates across the three stage EFs — four of which ($$ reviews, links,
// social, images) stop real Apify / Firecrawl / Perplexity spend. This console
// is the ONLY thing that writes app_config.enrichment_triggers, so deleting it
// would leave a code edit plus an EF redeploy as the only way to turn an
// expensive subprocess off. That is a capability loss, not a simplification.
//
// So the TAB died and the capability stayed. What actually got deleted is the
// part that made it a wall:
//   • the whole COOLDOWN column — zero readers in TS or SQL anywhere in the
//     repo; real cadence is places.enrich_every_days on the Place page;
//   • five of seven rows, behind one disclosure — they have no emitter;
//   • the 130-word Corrections essay, which had no input, no state, no writer.
// Seven rows × 12 columns plus two essays became two rows × 10 columns.
//
// STOP RENDERING, NEVER STOP CARRYING: save() posts the WHOLE `cfg`, seeded
// from the server blob and patched key-wise, so cooldownHours and every hidden
// row round-trip. Never rebuild the payload from what is rendered.
// `_shared/enrich-triggers.test.ts` is the gate.

import { useState, useTransition } from "react";
import { Lock, Radio } from "lucide-react";
import {
  type EnrichmentTriggersConfig,
  type EnrichmentTriggersMeta,
  updateEnrichmentTriggers,
} from "./actions";
import { ErrorNote } from "@/components/ErrorNote";
import { Collapsible, KnobStatus, SaveRow, SectionCard, Switch } from "./atlas-ui";

const COST_LABEL: Record<string, string> = {
  free: "free",
  low: "$",
  high: "$$",
};

// A cheap trigger that buys an expensive column is the one mistake this page
// can make that costs real money, so the grid says so out loud rather than
// leaving it to be discovered on the invoice.
const HIGH_FREQUENCY = new Set(["on_visit", "on_order", "on_reservation_ok"]);

type TriggerMetaRow = EnrichmentTriggersMeta["triggers"][number];

export function RunsSection({
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
          subprocesses: { ...row.subprocesses, [sub]: !row.subprocesses[sub] },
        },
      };
    });
    setDirty(true);
    setOk(false);
  };

  const save = () => {
    setError(null);
    startTransition(async () => {
      // The whole cfg — including the rows behind the disclosure and every
      // cooldownHours this page no longer draws.
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

  // The split the whole box hangs on. `staged` stopped being decoration the
  // moment it decided which table a row lands in — enrich-triggers.test.ts
  // pins it to exactly the rows with a real emitter.
  const live = meta.triggers.filter((t) => !t.staged);
  const staged = meta.triggers.filter((t) => t.staged);

  const grid = (rows: TriggerMetaRow[]) => (
    <Grid
      rows={rows}
      meta={meta}
      cfg={cfg}
      pending={pending}
      onPatchRow={patchRow}
      onToggleCell={toggleCell}
    />
  );

  return (
    <SectionCard
      icon={<Radio className="h-4 w-4" />}
      title="Runs"
      subtitle="Which event starts a run, and what that run is allowed to buy."
      status={
        <KnobStatus
          kind="enforced"
          reason="seeded onto place_research.subprocesses; the three stage EFs skip what a run did not buy"
        />
      }
    >
      <div className="mt-5">{grid(live)}</div>

      {staged.length > 0 && (
        <Collapsible summary={`Events with no emitter yet (${staged.length})`}>
          {grid(staged)}
        </Collapsible>
      )}

      {error && <ErrorNote message={error} />}
      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadError}
      />
    </SectionCard>
  );
}

/** The matrix itself. Same markup for the live rows and the folded ones. */
function Grid({
  rows,
  meta,
  cfg,
  pending,
  onPatchRow,
  onToggleCell,
}: {
  rows: TriggerMetaRow[];
  meta: EnrichmentTriggersMeta;
  cfg: EnrichmentTriggersConfig;
  pending: boolean;
  onPatchRow: (
    trigger: string,
    next: Partial<EnrichmentTriggersConfig[string]>,
  ) => void;
  onToggleCell: (trigger: string, sub: string) => void;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-border bg-muted/40 border-b">
            <th className="px-3 py-2.5 text-left font-semibold">Event</th>
            <th className="px-2 py-2.5 text-center font-semibold">On</th>
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
          {rows.map((t) => {
            const row = cfg[t.key];
            if (!row) return null;
            const locks = meta.locks[t.key] ?? {};
            const spendsOnHighFrequency =
              HIGH_FREQUENCY.has(t.key) &&
              meta.subprocesses.some(
                (s) => s.cost === "high" && row.subprocesses[s.key],
              );
            return (
              <tr key={t.key} className="border-border border-b last:border-0">
                <td className="max-w-[260px] px-3 py-3 align-top">
                  <span className="font-medium">{t.label}</span>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {t.blurb}
                  </p>
                  {spendsOnHighFrequency && (
                    <p className="mt-1 text-[11px] font-medium text-amber-700 dark:text-amber-500">
                      Fires many times a day and is buying a $$ subprocess.
                    </p>
                  )}
                </td>
                <td className="px-2 py-3 text-center align-top">
                  <Switch
                    on={row.enabled}
                    pending={pending}
                    onClick={() => onPatchRow(t.key, { enabled: !row.enabled })}
                    label={`${t.label} enabled`}
                  />
                </td>
                {meta.subprocesses.map((s) => {
                  const lock = locks[s.key];
                  const checked = lock ? lock.value : !!row.subprocesses[s.key];
                  return (
                    <td key={s.key} className="px-2 py-3 text-center align-top">
                      {lock ? (
                        <span
                          title={lock.reason}
                          className="text-muted-foreground inline-flex cursor-help items-center gap-1 text-xs"
                        >
                          <Lock className="h-3 w-3" />
                          {lock.value ? "on" : "off"}
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!row.enabled}
                          onChange={() => onToggleCell(t.key, s.key)}
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
  );
}
