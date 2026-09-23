"use client";

// Visits — three boxes of WIRED knobs. Unrendered keys still ride the whole
// blob (Ojo/Reservations law): proof, send-backs, pay rails, abandonment, v3.

import { useMemo } from "react";
import { Banknote, Flag, RefreshCw } from "lucide-react";
import { ErrorNote } from "@/components/ErrorNote";
import { formatShortDate } from "@/lib/format";
import {
  FIELD_WELL,
  KnobState,
  NumberField,
  SaveRow,
  SectionCard,
  Switch,
} from "@/components/admin-ui/config";
import { useConfigEditor, type ConfigSeed } from "@/components/admin-ui/use-config-editor";
import { getVisitsConfig, updateVisitsConfig } from "./actions";
import { VISITS_FALLBACK, type VisitsConfig } from "./defaults";

export function VisitsConfigClient({
  initialConfig,
  initialUpdatedAt,
  loadError,
}: ConfigSeed<VisitsConfig>) {
  const { cfg, setCfg, saved, setOk, pending, error, loadBlocked, ok, updatedAt, saveWith } =
    useConfigEditor({ initialConfig, initialUpdatedAt, loadError, load: getVisitsConfig });

  const dirty = useMemo(
    () => JSON.stringify(cfg) !== JSON.stringify(saved),
    [cfg, saved],
  );

  const patch = (p: Partial<VisitsConfig>) => {
    setOk(false);
    setCfg((c) => ({ ...c, ...p }));
  };

  const setPreset = (index: number, value: number) => {
    setOk(false);
    setCfg((c) => {
      const next = [...c.tipPresets];
      next[index] = Math.round(value);
      return { ...c, tipPresets: next };
    });
  };

  const defaultOffChip = !cfg.tipPresets.includes(cfg.defaultTipPct)
    ? "The preselected tip is not a chip; saving snaps it to the lowest."
    : null;

  const save = () =>
    saveWith(async (c) => {
      const presets = [...new Set(c.tipPresets.map(Math.round))]
        .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100)
        .sort((a, b) => a - b)
        .slice(0, 4);
      const next: VisitsConfig = {
        ...c,
        tipPresets: presets.length ? presets : [...VISITS_FALLBACK.tipPresets],
        defaultTipPct: presets.includes(c.defaultTipPct)
          ? c.defaultTipPct
          : (presets[0] ?? VISITS_FALLBACK.defaultTipPct),
        staffPollMaxSeconds: Math.max(
          c.staffPollSeconds,
          c.staffPollMaxSeconds,
        ),
      };
      return updateVisitsConfig(next);
    });

  return (
    <div className="space-y-6">
      {error ? <ErrorNote message={error} /> : null}

      <SectionCard
        icon={<Banknote className="text-secondary h-4 w-4" />}
        title="Bill"
        subtitle="Tip chips on the guest bill. Always calculated on the pre-discount total."
        state={
          updatedAt ? (
            <span className="text-muted-foreground text-xs">
              Updated {formatShortDate(updatedAt)}
            </span>
          ) : null
        }
      >
        <div className="mt-4">
          <KnobState
            kind="enforced"
            reason="consumer-web-get-ticket + consumer-web-submit-ticket-bill"
          />
        </div>
        <div className="mt-5 space-y-4">
          <div className="border-border bg-background flex items-start justify-between gap-4 rounded-xl border p-4">
            <div>
              <div className="text-sm font-medium leading-snug">Offer a tip</div>
              <div className="text-muted-foreground mt-0.5 type-label">
                Off hides the chips and records a 0 tip.
              </div>
            </div>
            <Switch
              label="Offer a tip"
              on={cfg.tipEnabled}
              pending={pending}
              onClick={() => patch({ tipEnabled: !cfg.tipEnabled })}
            />
          </div>

          <div className="border-border bg-background rounded-xl border p-4">
            <div className="text-sm font-medium leading-snug">Chips (%)</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cfg.tipPresets.map((p, i) => (
                <input
                  key={i}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  value={p}
                  disabled={pending || !cfg.tipEnabled}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    if (Number.isNaN(raw)) return;
                    setPreset(i, raw);
                  }}
                  className="border-border bg-card focus:border-foreground h-9 w-16 rounded-lg border px-2 text-center text-sm tabular-nums outline-none disabled:opacity-50"
                  aria-label={`Tip chip ${i + 1}`}
                />
              ))}
              {cfg.tipPresets.length < 4 ? (
                <button
                  type="button"
                  disabled={pending || !cfg.tipEnabled}
                  onClick={() =>
                    patch({
                      tipPresets: [...cfg.tipPresets, 25],
                    })
                  }
                  className="border-border text-muted-foreground hover:text-foreground h-9 rounded-lg border px-3 text-sm disabled:opacity-50"
                >
                  Add
                </button>
              ) : null}
              {cfg.tipPresets.length > 1 ? (
                <button
                  type="button"
                  disabled={pending || !cfg.tipEnabled}
                  onClick={() =>
                    patch({ tipPresets: cfg.tipPresets.slice(0, -1) })
                  }
                  className="border-border text-muted-foreground hover:text-foreground h-9 rounded-lg border px-3 text-sm disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>

          <label className={FIELD_WELL}>
            <span className="text-sm font-medium leading-snug">
              Preselected chip
            </span>
            <select
              value={cfg.defaultTipPct}
              disabled={pending || !cfg.tipEnabled}
              onChange={(e) => patch({ defaultTipPct: Number(e.target.value) })}
              className="border-border bg-card focus:border-foreground h-9 rounded-lg border px-3 text-sm outline-none disabled:opacity-50"
            >
              {cfg.tipPresets.map((p) => (
                <option key={p} value={p}>
                  {p}%
                </option>
              ))}
            </select>
            {defaultOffChip ? (
              <span className="text-amber-700 type-label">{defaultOffChip}</span>
            ) : null}
          </label>
        </div>
      </SectionCard>

      <SectionCard
        icon={<RefreshCw className="text-secondary h-4 w-4" />}
        title="Sync"
        subtitle="Polling is the handshake. Realtime stays off visit_tickets."
      >
        <div className="mt-4">
          <KnobState
            kind="enforced"
            reason="Guest poll on consumer-web-get-ticket · staff poll on validate-web-get-ticket"
          />
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Guest poll (s)"
            value={cfg.consumerPollSeconds}
            min={2}
            max={120}
            disabled={pending}
            onChange={(v) => patch({ consumerPollSeconds: v })}
          />
          <NumberField
            label="Staff poll (s)"
            value={cfg.staffPollSeconds}
            min={1}
            max={120}
            disabled={pending}
            onChange={(v) => patch({ staffPollSeconds: v })}
          />
          <NumberField
            label="Staff backoff cap (s)"
            value={cfg.staffPollMaxSeconds}
            min={1}
            max={600}
            disabled={pending}
            onChange={(v) => patch({ staffPollMaxSeconds: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        icon={<Flag className="text-secondary h-4 w-4" />}
        title="Report"
        subtitle="The guest's route that is not arguing with the floor."
      >
        <div className="mt-4">
          <KnobState
            kind="enforced"
            reason="consumer-web-report-ticket · THE TICKET footer"
          />
        </div>
        <div className="border-border bg-background mt-5 flex items-start justify-between gap-4 rounded-xl border p-4">
          <div>
            <div className="text-sm font-medium leading-snug">
              Report a problem
            </div>
            <div className="text-muted-foreground mt-0.5 type-label">
              Off hides the button and the EF answers 409.
            </div>
          </div>
          <Switch
            label="Report a problem"
            on={cfg.reportEnabled}
            pending={pending}
            onClick={() => patch({ reportEnabled: !cfg.reportEnabled })}
          />
        </div>
      </SectionCard>

      <SaveRow
        pending={pending}
        dirty={dirty}
        ok={ok}
        onClick={save}
        loadError={loadBlocked ? error : null}
      />
    </div>
  );
}
